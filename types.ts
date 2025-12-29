
import * as THREE from 'three';

export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER'
}

export enum VehicleType {
  CAR = 'CAR',
  TRUCK = 'TRUCK'
}

export enum TrafficDirection {
  SAME = 'SAME',
  OPPOSITE = 'OPPOSITE'
}

export interface GameState {
  status: GameStatus;
  score: number;
  highScore: number;
}
