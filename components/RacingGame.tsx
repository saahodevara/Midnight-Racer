
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
    traffic: [] as (THREE.Group & { isDamaged?: boolean })[],
    roadChunks: [] as THREE.Mesh[],
    lastSpawn: 0,
    isGameOver: false,
    time: 0,
  });

  useEffect(() => {
    gameRef.current.status = status;
    if (status === GameStatus.PLAYING) {
      gameRef.current.playerX = 0;
      gameRef.current.speed = BASE_SPEED;
      gameRef.current.distance = 0;
      gameRef.current.isGameOver = false;
      gameRef.current.lastSpawn = 0;
      
      gameRef.current.traffic.forEach(t => {
        t.parent?.remove(t);
      });
      gameRef.current.traffic = [];
    }
  }, [status]);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 20, 150);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 8);
    camera.lookAt(0, 1, -20);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    // Reduced intensity for player glow as requested
    const playerPointLight = new THREE.PointLight(COLORS.PLAYER, 8, 12); 
    playerPointLight.position.set(0, 1.5, 0);
    scene.add(playerPointLight);

    const roadGeom = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.8 });
    
    const createRoadChunk = (z: number) => {
      const mesh = new THREE.Mesh(roadGeom, roadMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.z = z;
      
      const stripGeom = new THREE.PlaneGeometry(0.1, ROAD_LENGTH);
      const stripMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
      
      [-ROAD_WIDTH / 2 + 0.1, ROAD_WIDTH / 2 - 0.1].forEach(x => {
        const strip = new THREE.Mesh(stripGeom, stripMat);
        strip.position.set(x, 0.01, 0);
        mesh.add(strip);
      });

      scene.add(mesh);
      return mesh;
    };

    const chunks = [
      createRoadChunk(0),
      createRoadChunk(-ROAD_LENGTH)
    ];
    gameRef.current.roadChunks = chunks;

    const playerGroup = new THREE.Group();
    const carBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.6, 4),
      new THREE.MeshStandardMaterial({ color: COLORS.PLAYER, metalness: 0.4, roughness: 0.6 })
    );
    carBody.position.y = 0.3;
    playerGroup.add(carBody);

    const carCabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.4, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x050505 })
    );
    carCabin.position.set(0, 0.7, -0.2);
    playerGroup.add(carCabin);
    
    scene.add(playerGroup);

    const spawnTraffic = () => {
      const isDamaged = Math.random() < 0.15; // 15% chance of spawning a damaged vehicle
      const lane = LANES[Math.floor(Math.random() * LANES.length)];
      const car = new THREE.Group() as THREE.Group & { isDamaged: boolean };
      car.isDamaged = isDamaged;
      
      const bodyMat = new THREE.MeshStandardMaterial({ 
        color: isDamaged ? 0x222222 : 0x444444,
        roughness: isDamaged ? 1.0 : 0.5
      });
      
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 4), bodyMat);
      body.position.y = 0.3;
      car.add(body);

      // Light setup based on vehicle state
      const lightGeom = new THREE.CircleGeometry(0.2, 8);
      
      if (isDamaged) {
        // Red hazard lights for damaged vehicles
        const hazardMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        [-0.7, 0.7].forEach(x => {
          const l = new THREE.Mesh(lightGeom, hazardMat);
          l.position.set(x, 0.4, 2.01);
          l.name = "hazard_light";
          car.add(l);
        });
      } else {
        // White focusing headlights for running vehicles
        const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        [-0.7, 0.7].forEach(x => {
          const l = new THREE.Mesh(lightGeom, headMat);
          l.position.set(x, 0.4, -2.01);
          l.rotation.y = Math.PI;
          car.add(l);
          
          // Add headlight glow
          const spot = new THREE.SpotLight(0xffffff, 2, 10, Math.PI/4);
          spot.position.set(x, 0.4, -2.1);
          spot.target.position.set(x, 0.4, -10);
          car.add(spot);
          car.add(spot.target);
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
        // Visual feedback for player crash: flashing red lights
        const flash = Math.sin(state.time * 15) > 0;
        playerPointLight.color.setHex(flash ? 0xff0000 : 0x220000);
        playerPointLight.intensity = flash ? 15 : 2;
        renderer.render(scene, camera);
        return;
      }

      state.speed = Math.min(MAX_SPEED, state.speed + ACCELERATION * dt);
      state.distance += state.speed * dt;
      onScoreUpdate(state.distance);

      let steerDir = 0;
      if (state.keys.a || state.keys.arrowleft) steerDir -= 1;
      if (state.keys.d || state.keys.arrowright) steerDir += 1;
      state.playerX += steerDir * STEER_SPEED * dt;
      
      const limit = ROAD_WIDTH / 2 - 1.2;
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
        
        // Damaged cars are stationary relative to the road
        // Running cars move forward relative to road
        const relativeSpeed = car.isDamaged ? 0 : (state.speed * 0.35);
        car.position.z += (state.speed - relativeSpeed) * dt;

        // Animate hazard lights for damaged vehicles
        if (car.isDamaged) {
          const hazardFlash = Math.sin(state.time * 10) > 0;
          car.children.forEach(child => {
            if (child.name === "hazard_light") {
              (child as THREE.Mesh).visible = hazardFlash;
            }
          });
        }

        const distZ = Math.abs(car.position.z - PLAYER_Z);
        const distX = Math.abs(car.position.x - state.playerX);
        if (distZ < 3.8 && distX < 1.6) {
          state.isGameOver = true;
          onGameOver(state.distance);
        }

        if (car.position.z > DESPAWN_DISTANCE) {
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
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default RacingGame;
