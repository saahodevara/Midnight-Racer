
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameStatus } from '../types';
import { 
  LANES, COLORS, ROAD_WIDTH, ROAD_LENGTH, SPAWN_DISTANCE, DESPAWN_DISTANCE, 
  BASE_SPEED, MAX_SPEED, ACCELERATION, PLAYER_Z, STEER_SPEED 
} from '../constants';

interface Props {
  status: GameStatus;
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
}

const RacingGame: React.FC<Props> = ({ status, onGameOver, onScoreUpdate }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  
  const gameRef = useRef({
    status,
    playerX: 0,
    speed: BASE_SPEED,
    distance: 0,
    keys: { a: false, d: false, arrowleft: false, arrowright: false },
    traffic: [] as (THREE.Group & { isDamaged?: boolean; audio?: THREE.PositionalAudio; osc?: OscillatorNode })[],
    roadChunks: [] as THREE.Mesh[],
    lastSpawn: 0,
    isGameOver: false,
    time: 0,
    // Audio Context & Nodes
    audioListener: null as THREE.AudioListener | null,
    engineOsc: null as OscillatorNode | null,
    engineGain: null as GainNode | null,
  });

  // Handle game status changes (Start/Reset)
  useEffect(() => {
    gameRef.current.status = status;
    if (status === GameStatus.PLAYING) {
      gameRef.current.playerX = 0;
      gameRef.current.speed = BASE_SPEED;
      gameRef.current.distance = 0;
      gameRef.current.isGameOver = false;
      gameRef.current.lastSpawn = 0;
      
      gameRef.current.traffic.forEach(t => {
        if (t.osc) t.osc.stop();
        t.parent?.remove(t);
      });
      gameRef.current.traffic = [];
      
      resumeAudio();
    } else {
      stopAllAudio();
    }
  }, [status]);

  const resumeAudio = () => {
    const ctx = THREE.AudioContext.getContext();
    if (ctx.state === 'suspended') ctx.resume();
    if (gameRef.current.engineGain) {
      gameRef.current.engineGain.gain.setTargetAtTime(0.1, ctx.currentTime, 0.2);
    }
  };

  const stopAllAudio = () => {
    const ctx = THREE.AudioContext.getContext();
    if (gameRef.current.engineGain) {
      gameRef.current.engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    }
    gameRef.current.traffic.forEach(t => {
      if (t.osc) {
        try { t.osc.stop(); } catch(e) {}
      }
    });
  };

  const playCrashSound = () => {
    const ctx = THREE.AudioContext.getContext();
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(1000, ctx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.4);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    whiteNoise.start();
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 30, 160);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4.5, 8.5);
    camera.lookAt(0, 1, -25);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // --- Audio System Initialization ---
    const listener = new THREE.AudioListener();
    camera.add(listener);
    gameRef.current.audioListener = listener;

    const ctx = THREE.AudioContext.getContext();
    const engineOsc = ctx.createOscillator();
    const engineGain = ctx.createGain();
    const engineFilter = ctx.createBiquadFilter();

    engineOsc.type = 'sawtooth';
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 800;
    engineGain.gain.value = 0; // Start silent

    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();

    gameRef.current.engineOsc = engineOsc;
    gameRef.current.engineGain = engineGain;

    // --- Scene Elements ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    
    // Reduced intensity player glow as requested
    const playerPointLight = new THREE.PointLight(COLORS.PLAYER, 8, 12); 
    playerPointLight.position.set(0, 2, 0);
    scene.add(playerPointLight);

    const roadGeom = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 });
    
    const createRoadChunk = (z: number) => {
      const mesh = new THREE.Mesh(roadGeom, roadMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.z = z;
      
      const stripGeom = new THREE.PlaneGeometry(0.15, ROAD_LENGTH);
      const stripMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
      [-ROAD_WIDTH / 2 + 0.1, ROAD_WIDTH / 2 - 0.1].forEach(x => {
        const strip = new THREE.Mesh(stripGeom, stripMat);
        strip.position.set(x, 0.01, 0);
        mesh.add(strip);
      });
      scene.add(mesh);
      return mesh;
    };

    gameRef.current.roadChunks = [createRoadChunk(0), createRoadChunk(-ROAD_LENGTH)];

    // Detailed Player Model
    const playerGroup = new THREE.Group();
    const carBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.6, 4.2),
      new THREE.MeshStandardMaterial({ color: COLORS.PLAYER, metalness: 0.6, roughness: 0.4 })
    );
    carBody.position.y = 0.3;
    playerGroup.add(carBody);

    const carCabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.5, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
    );
    carCabin.position.set(0, 0.8, -0.2);
    playerGroup.add(carCabin);
    scene.add(playerGroup);

    const spawnTraffic = () => {
      const isDamaged = Math.random() < 0.2; // 20% damaged vehicles
      const lane = LANES[Math.floor(Math.random() * LANES.length)];
      const car = new THREE.Group() as any;
      car.isDamaged = isDamaged;
      
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.7, 4.5),
        new THREE.MeshStandardMaterial({ color: isDamaged ? 0x222222 : 0x444444 })
      );
      body.position.y = 0.35;
      car.add(body);

      // Positional Audio for traffic
      if (gameRef.current.audioListener) {
        const posAudio = new THREE.PositionalAudio(gameRef.current.audioListener);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = isDamaged ? 'square' : 'sawtooth';
        osc.frequency.value = isDamaged ? 60 : 100;
        gain.gain.value = 0.04;
        osc.connect(gain);
        posAudio.setNodeSource(gain as any);
        posAudio.setRefDistance(5);
        car.add(posAudio);
        car.audio = posAudio;
        car.osc = osc;
        osc.start();
      }

      if (isDamaged) {
        // ONLY damaged vehicles have RED danger lights
        const lightGeom = new THREE.CircleGeometry(0.2, 8);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        [-0.7, 0.7].forEach(x => {
          const l = new THREE.Mesh(lightGeom, lightMat);
          l.position.set(x, 0.45, 2.26);
          l.name = "danger_light";
          car.add(l);
        });
      } else {
        // RUNNING vehicles use WHITE focusing light
        const lightGeom = new THREE.CircleGeometry(0.25, 12);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        [-0.75, 0.75].forEach(x => {
          const l = new THREE.Mesh(lightGeom, lightMat);
          l.position.set(x, 0.45, -2.26);
          l.rotation.y = Math.PI;
          car.add(l);
        });
      }

      car.position.set(lane, 0, SPAWN_DISTANCE);
      scene.add(car);
      gameRef.current.traffic.push(car);
    };

    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const state = gameRef.current;
      const dt = clock.getDelta();
      state.time += dt;

      if (state.status !== GameStatus.PLAYING) {
        renderer.render(scene, camera);
        return;
      }

      if (state.isGameOver) {
        stopAllAudio();
        renderer.render(scene, camera);
        return;
      }

      // Update Engine Audio pitch based on speed
      if (state.engineOsc) {
        const freq = 50 + (state.speed * 1.5);
        state.engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.1);
      }

      state.speed = Math.min(MAX_SPEED, state.speed + ACCELERATION * dt);
      state.distance += state.speed * dt;
      onScoreUpdate(state.distance);

      let steerDir = 0;
      if (state.keys.a || state.keys.arrowleft) steerDir -= 1;
      if (state.keys.d || state.keys.arrowright) steerDir += 1;
      state.playerX += steerDir * STEER_SPEED * dt;
      
      const limit = ROAD_WIDTH / 2 - 1.4;
      state.playerX = Math.max(-limit, Math.min(limit, state.playerX));
      
      playerGroup.position.x = state.playerX;
      playerGroup.rotation.z = THREE.MathUtils.lerp(playerGroup.rotation.z, -steerDir * 0.05, 0.1);
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, state.playerX * 0.4, 0.05);
      playerPointLight.position.x = state.playerX;

      state.roadChunks.forEach(chunk => {
        chunk.position.z += state.speed * dt;
        if (chunk.position.z > ROAD_LENGTH / 2) {
          chunk.position.z -= ROAD_LENGTH * 2;
        }
      });

      state.lastSpawn += dt;
      const spawnInterval = 1.4 / (state.speed / BASE_SPEED);
      if (state.lastSpawn > spawnInterval) {
        spawnTraffic();
        state.lastSpawn = 0;
      }

      for (let i = state.traffic.length - 1; i >= 0; i--) {
        const car = state.traffic[i];
        const relativeSpeed = car.isDamaged ? 0 : (state.speed * 0.35);
        car.position.z += (state.speed - relativeSpeed) * dt;

        if (car.isDamaged) {
          const hazardFlash = Math.sin(state.time * 12) > 0;
          car.children.forEach(child => {
            if (child.name === "danger_light") child.visible = hazardFlash;
          });
        }

        const distZ = Math.abs(car.position.z - PLAYER_Z);
        const distX = Math.abs(car.position.x - state.playerX);
        if (distZ < 4.0 && distX < 1.7) {
          state.isGameOver = true;
          playCrashSound();
          onGameOver(state.distance);
        }

        if (car.position.z > DESPAWN_DISTANCE) {
          if (car.osc) car.osc.stop();
          scene.remove(car);
          state.traffic.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleKey = (e: KeyboardEvent, isDown: boolean) => {
      const key = e.key.toLowerCase();
      if (key in gameRef.current.keys) {
        (gameRef.current.keys as any)[key] = isDown;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => handleKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => handleKey(e, false);
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
      if (gameRef.current.engineOsc) gameRef.current.engineOsc.stop();
      gameRef.current.traffic.forEach(t => t.osc?.stop());
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default RacingGame;
