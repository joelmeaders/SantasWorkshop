import { BaseEntity } from './base-entity';
import firebase from 'firebase/app';

export class ICheckIn extends BaseEntity {
  customerId?: string;
  registrationCode?: string;
  checkInDateTime: firebase.firestore.Timestamp;
  inStats: boolean = false;
  stats: ICheckInStats | undefined;
}

export interface ICheckInStats {
  preregistered: boolean;
  children: number;
  ageGroup02: number;
  ageGroup35: number;
  ageGroup68: number;
  ageGroup911: number;
  toyTypeInfant: number;
  toyTypeBoy: number;
  toyTypeGirl: number;
  zipCode: string;
  modifiedAtCheckIn: boolean;
}

export interface ICheckInAgeStats {
  ageGroup02: number;
  ageGroup35: number;
  ageGroup68: number;
  ageGroup911: number;
  totalChildren: number;
  totalb: number;
  totalg: number;
  totali: number;
  lastRun: Date;
}
