
export const LANES = [-6, -2, 2, 6];
export const ROAD_WIDTH = 16;
export const ROAD_LENGTH = 200; 
export const SPAWN_DISTANCE = -150; 
export const DESPAWN_DISTANCE = 50;

// Progression
export const BASE_SPEED = 40; 
export const MAX_SPEED = 120;
export const ACCELERATION = 2; // Speed increase per second

// Player Physics
export const STEER_SPEED = 15;
export const PLAYER_Z = 0;

// Traffic AI
export const TRAFFIC_SPEED_MIN = 15;
export const TRAFFIC_SPEED_MAX = 45;
export const LANE_CHANGE_DURATION = 0.8;
export const BRAKE_DISTANCE = 25;
export const CRITICAL_DISTANCE = 12;

export const VEHICLE_DIMENSIONS = {
  CAR: { width: 1.8, height: 0.8, length: 4 },
  TRUCK: { width: 2.2, height: 2.0, length: 8 }
};

export const COLORS = {
  PLAYER: 0xFF4500,
  TRAFFIC: 0x333333,
  ROAD: 0x111111,
  GLOW: 0x00FFFF,
  BRAKE_LIGHT: 0xFF0000,
  INDICATOR: 0xFFAA00,
};
