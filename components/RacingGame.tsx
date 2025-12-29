
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameStatus, VehicleType, TrafficDirection } from '../types';
import { 
  LANES, COLORS, ROAD_WIDTH, ROAD_LENGTH, SPAWN_DISTANCE, DESPAWN_DISTANCE, 
  BASE_SPEED, SPEED_INCREMENT_PER_MILESTONE, MILESTONE_DISTANCE, MAX_SPEED, VEHICLE_DIMENSIONS,
  STEER_ACCEL, LATERAL_FRICTION
} from '../constants';

interface Props {
  status: GameStatus;
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  onSpeedLevelUp: () => void;
}

// Pre-shared Assets for Performance (Avoid GC Pressure)
const sharedGeoms = {
  carBody: new THREE.BoxGeometry(VEHICLE_DIMENSIONS.CAR.width, VEHICLE_DIMENSIONS.CAR.height * 0.5, VEHICLE_DIMENSIONS.CAR.length),
  carCabin: new THREE.BoxGeometry(VEHICLE_DIMENSIONS.CAR.width * 0.8, VEHICLE_DIMENSIONS.CAR.height * 0.6, VEHICLE_DIMENSIONS.CAR.length * 0.5),
  wheel: new THREE.CylinderGeometry(0.35, 0.35, 0.4, 8), // Low poly for speed
  road: new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH),
  neonStrip: new THREE.PlaneGeometry(0.12, ROAD_LENGTH),
  lightCone: new THREE.CylinderGeometry(0.1, 4, 15, 12, 1, true).rotateX(Math.PI/2).translate(0, 0, 7.5),
};

const sharedMats = {
  road: new THREE.MeshStandardMaterial({ color: 0x010101, roughness: 1 }),
  neon: new THREE.MeshBasicMaterial({ color: COLORS.GLOW_STRIP, transparent: true, opacity: 0.4 }),
  whiteLight: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, depthWrite: false }),
  redLight: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
  wheel: new THREE.MeshStandardMaterial({ color: 0x050505 }),
};

const RacingGame: React.FC<Props> = ({ status, onGameOver, onScoreUpdate, onSpeedLevelUp }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const trafficGroupRef = useRef<THREE.Group | null>(null);
  const roadGroupRef = useRef<THREE.Group | null>(null);
  
  const audioRef = useRef<{
    ctx: AudioContext | null;
    osc1: OscillatorNode | null;
    osc2: OscillatorNode | null;
    noiseNode: AudioBufferSourceNode | null;
    noiseGain: GainNode | null;
    engineGain: GainNode | null;
  }>({ ctx: null, osc1: null, osc2: null, noiseNode: null, noiseGain: null, engineGain: null });

  const stateRef = useRef({
    status,
    score: 0,
    gameSpeed: BASE_SPEED,
    playerX: 0,
    playerVX: 0,
    traffic: [] as any[],
    lastTrafficSpawn: 0,
    keys: { left: false, right: false },
    isGameOver: false,
    currentMilestone: 0,
    startTime: 0,
  });

  const initAudio = () => {
    if (audioRef.current.ctx) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Engine Oscillator 1 (Low growl)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      
      // Engine Oscillator 2 (Higher harmonic)
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.detune.setValueAtTime(12, ctx.currentTime);

      const engineGain = ctx.createGain();
      engineGain.gain.setValueAtTime(0, ctx.currentTime);
      
      osc1.connect(engineGain);
      osc2.connect(engineGain);
      engineGain.connect(ctx.destination);
      
      // Road Noise (Wind/Friction)
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < ctx.sampleRate; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;
      
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(400, ctx.currentTime);
      
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, ctx.currentTime);
      
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      noiseSource.start();

      audioRef.current = { ctx, osc1, osc2, noiseNode: noiseSource, noiseGain, engineGain };
    } catch (e) {
      console.warn("Audio init failed:", e);
    }
  };

  const resumeAudio = () => {
    const { ctx, engineGain, noiseGain } = audioRef.current;
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      engineGain?.gain.setTargetAtTime(0.1, ctx.currentTime, 0.2);
      noiseGain?.gain.setTargetAtTime(0.05, ctx.currentTime, 0.2);
    }
  };

  const stopAudio = () => {
    const { engineGain, noiseGain, ctx } = audioRef.current;
    if (ctx) {
      engineGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      noiseGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    }
  };

  useEffect(() => {
    stateRef.current.status = status;
    if (status === GameStatus.PLAYING) {
      initAudio();
      resumeAudio(); 
      const current = stateRef.current;
      current.score = 0;
      current.gameSpeed = BASE_SPEED;
      current.playerX = 0;
      current.playerVX = 0;
      current.isGameOver = false;
      current.lastTrafficSpawn = 0;
      current.currentMilestone = 0;
      current.startTime = Date.now();

      if (trafficGroupRef.current) trafficGroupRef.current.clear();
      current.traffic = [];

      if (playerRef.current) {
        playerRef.current.position.set(0, 0, 0);
        playerRef.current.rotation.set(0, 0, 0);
      }
    } else if (status === GameStatus.GAMEOVER) {
      stopAudio();
    }
  }, [status]);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 10, 150);
    
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio > 1.5 ? 1.5 : 1);
    mountRef.current.appendChild(renderer.domElement);
    
    scene.add(new THREE.AmbientLight(0xffffff, 0.005));

    const trafficGroup = new THREE.Group();
    trafficGroupRef.current = trafficGroup;
    scene.add(trafficGroup);

    const roadGroup = new THREE.Group();
    roadGroupRef.current = roadGroup;
    const createRoadChunk = (z: number) => {
      const chunk = new THREE.Group();
      const road = new THREE.Mesh(sharedGeoms.road, sharedMats.road);
      road.rotation.x = -Math.PI / 2;
      chunk.add(road);
      [-ROAD_WIDTH/2 + 0.06, ROAD_WIDTH/2 - 0.06].forEach(lx => {
        const s = new THREE.Mesh(sharedGeoms.neonStrip, sharedMats.neon);
        s.rotation.x = -Math.PI / 2;
        s.position.set(lx, 0.03, 0);
        chunk.add(s);
      });
      chunk.position.z = z;
      return chunk;
    };
    roadGroup.add(createRoadChunk(0), createRoadChunk(-ROAD_LENGTH));
    scene.add(roadGroup);

    const createVehicle = (type: VehicleType, color: number, direction: TrafficDirection, isPlayer: boolean = false) => {
      const group = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 });

      const base = new THREE.Mesh(sharedGeoms.carBody, bodyMat);
      base.position.y = 0.4;
      group.add(base);

      const cabin = new THREE.Mesh(sharedGeoms.carCabin, bodyMat);
      cabin.position.set(0, 0.9, 0);
      group.add(cabin);

      if (isPlayer) {
        const interiorLight = new THREE.PointLight(COLORS.PLAYER, 12, 3.5);
        interiorLight.position.set(0, 0.8, 0);
        group.add(interiorLight);
      } else {
        if (direction === TrafficDirection.OPPOSITE) {
          [-0.6, 0.6].forEach(x => {
            const head = new THREE.SpotLight(0xffffff, 60, 80, 0.4, 0.5, 1);
            head.position.set(x, 0.6, 2.0);
            head.target.position.set(x, 0, 150);
            group.add(head, head.target);
            const cone = new THREE.Mesh(sharedGeoms.lightCone, sharedMats.whiteLight);
            cone.position.set(x, 0.6, 2.0);
            group.add(cone);
          });
        } else {
          [-0.6, 0.6].forEach(x => {
            const tl = new THREE.Mesh(new THREE.CircleGeometry(0.15, 8), sharedMats.redLight);
            tl.position.set(x, 0.55, 2.1);
            group.add(tl);
            const spot = new THREE.SpotLight(0xff0000, 15, 30, 0.6, 0.5, 1);
            spot.position.set(x, 0.55, 2.1);
            spot.target.position.set(x, 0, 50);
            group.add(spot, spot.target);
          });
        }
      }

      [[-0.8, 0.3, 1.4], [0.8, 0.3, 1.4], [-0.8, 0.3, -1.4], [0.8, 0.3, -1.4]].forEach(p => {
        const w = new THREE.Mesh(sharedGeoms.wheel, sharedMats.wheel);
        w.rotation.z = Math.PI / 2;
        w.position.set(p[0], p[1], p[2]);
        group.add(w);
      });

      return group;
    };

    const playerMesh = createVehicle(VehicleType.CAR, COLORS.PLAYER, TrafficDirection.SAME, true);
    playerRef.current = playerMesh;
    scene.add(playerMesh);

    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) stateRef.current.keys.left = isDown;
      if (['ArrowRight', 'd', 'D'].includes(e.key)) stateRef.current.keys.right = isDown;
    };

    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const current = stateRef.current;
      if (current.isGameOver || current.status !== GameStatus.PLAYING) {
        renderer.render(scene, camera);
        return;
      }

      const delta = Math.min(clock.getDelta(), 0.1);
      
      // Steering
      let steerDir = 0;
      if (current.keys.left) steerDir -= 1;
      if (current.keys.right) steerDir += 1;
      current.playerVX += steerDir * STEER_ACCEL;
      current.playerVX *= LATERAL_FRICTION;
      current.playerX += current.playerVX;
      
      const bound = ROAD_WIDTH / 2 - 1.2;
      if (current.playerX > bound) { current.playerX = bound; current.playerVX = 0; }
      if (current.playerX < -bound) { current.playerX = -bound; current.playerVX = 0; }
      
      playerRef.current!.position.x = current.playerX;
      playerRef.current!.rotation.y = -current.playerVX * 1.5;
      playerRef.current!.rotation.z = -current.playerVX * 0.5;

      // Progression
      const milestone = Math.floor(current.score / MILESTONE_DISTANCE);
      if (milestone > current.currentMilestone) {
        current.currentMilestone = milestone;
        current.gameSpeed = Math.min(MAX_SPEED, BASE_SPEED + (milestone * SPEED_INCREMENT_PER_MILESTONE));
        onSpeedLevelUp();
      }

      const speedRatio = (current.gameSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
      const shake = Math.sin(Date.now() * 0.05) * (0.01 + speedRatio * 0.06);
      camera.fov = 72 + (speedRatio * 25);
      camera.updateProjectionMatrix();
      camera.position.set(current.playerX * 0.35 + shake, 8 + (speedRatio * 2.5), 11 + (speedRatio * 2.5));
      camera.lookAt(current.playerX, 0.5, -60);

      // Environment Sync
      roadGroup.children.forEach(chunk => {
        chunk.position.z += current.gameSpeed * 80 * delta;
        if (chunk.position.z > ROAD_LENGTH / 2) chunk.position.z -= ROAD_LENGTH;
      });

      // Optimized Traffic Loop
      current.lastTrafficSpawn += delta;
      const spawnInterval = 1.0 / (current.gameSpeed * 1.3 + 0.5);
      if (current.lastTrafficSpawn > spawnInterval) {
        const laneIdx = Math.floor(Math.random() * LANES.length);
        const direction = laneIdx < 2 ? TrafficDirection.OPPOSITE : TrafficDirection.SAME;
        const npc = createVehicle(VehicleType.CAR, COLORS.TRAFFIC[Math.floor(Math.random()*COLORS.TRAFFIC.length)], direction);
        npc.position.set(LANES[laneIdx], 0, SPAWN_DISTANCE);
        if (direction === TrafficDirection.OPPOSITE) npc.rotation.y = Math.PI;
        trafficGroup.add(npc);
        current.traffic.push({ mesh: npc, speedMod: direction === TrafficDirection.OPPOSITE ? 1.8 : 0.45 });
        current.lastTrafficSpawn = 0;
      }

      // Physics (Optimized AABB)
      const pX = current.playerX;
      const pZ = 0;
      const pW = VEHICLE_DIMENSIONS.CAR.width * 0.45;
      const pL = VEHICLE_DIMENSIONS.CAR.length * 0.45;
      const invincibility = (Date.now() - current.startTime) < 2500;

      for (let i = current.traffic.length - 1; i >= 0; i--) {
        const t = current.traffic[i];
        t.mesh.position.z += (current.gameSpeed * 68 * t.speedMod * delta);
        
        const tZ = t.mesh.position.z;
        const tX = t.mesh.position.x;
        
        // Fast collision check (Only if in range)
        if (!invincibility && tZ > -6 && tZ < 6) {
          if (Math.abs(pX - tX) < pW * 2 && Math.abs(pZ - tZ) < pL * 2) {
            current.isGameOver = true;
            onGameOver(current.score);
            break;
          }
        }
        
        if (tZ > DESPAWN_DISTANCE) {
          trafficGroup.remove(t.mesh);
          current.traffic.splice(i, 1);
        }
      }

      current.score += current.gameSpeed * 22 * delta;
      onScoreUpdate(current.score);

      // Audio Modulation
      const { osc1, osc2, noiseGain, engineGain, ctx } = audioRef.current;
      if (ctx && osc1 && osc2) {
        const s = (current.gameSpeed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED);
        osc1.frequency.setTargetAtTime(32 + s * 220, ctx.currentTime, 0.1);
        osc2.frequency.setTargetAtTime(64 + s * 330, ctx.currentTime, 0.1);
        engineGain?.gain.setTargetAtTime(0.08 + s * 0.12, ctx.currentTime, 0.1);
        noiseGain?.gain.setTargetAtTime(0.04 + s * 0.1, ctx.currentTime, 0.1);
      }

      renderer.render(scene, camera);
    };

    const clock = new THREE.Clock();
    let frameId = requestAnimationFrame(animate);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full cursor-none overflow-hidden touch-none" />;
};

export default RacingGame;
