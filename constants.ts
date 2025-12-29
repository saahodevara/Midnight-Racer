
export const LANES = [-6.5, -2.5, 2.5, 6.5];
export const ROAD_WIDTH = 18;
export const ROAD_LENGTH = 1000;
export const SPAWN_DISTANCE = -300; // Far ahead
export const DESPAWN_DISTANCE = 100; // Behind player
export const SAFE_ZONE_RADIUS = 100; // No spawns within this Z-range of player at start

// Stealth Racer Progression
export const BASE_SPEED = 0.5; 
export const SPEED_INCREMENT_PER_MILESTONE = 0.2;
export const MILESTONE_DISTANCE = 300;
export const MAX_SPEED = 12.0;

// Physics Constants
export const STEER_ACCEL = 0.025; 
export const LATERAL_FRICTION = 0.92;

export const VEHICLE_DIMENSIONS = {
  CAR: { width: 1.8, height: 1.0, length: 4.0 },
  TRUCK: { width: 2.2, height: 2.2, length: 7.5 }
};

export const COLORS = {
  PLAYER: 0xFF4500, // Vibrant Orange
  TRAFFIC: [0x111111, 0x0a0a0a, 0x151515],
  ROAD: 0x020202,
  GLOW_STRIP: 0x00FFFF, // Cyan Neon Edge
};
