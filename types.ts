
export enum AppView {
  GENDER_SELECT = 'GENDER_SELECT',
  CALLSIGN_SETUP = 'CALLSIGN_SETUP',
  JOIN = 'JOIN',
  ROOM = 'ROOM'
}

export enum TransmitStatus {
  IDLE = 'IDLE',
  TALKING = 'TALKING',
  RECEIVING = 'RECEIVING'
}

export type UserGender = 'male' | 'female';

export interface RoomInfo {
  code: string;
  createdAt: number;
}

export interface Message {
  id: string;
  sender: 'user' | 'system';
  text: string;
  timestamp: number;
  callsign?: string;
}

export interface AppTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
}
