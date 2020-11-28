import * as firebase from 'firebase';
import { BaseEntity } from './base-entity';

export class ICheckIn extends BaseEntity {
  customerId?: string;
  registrationCode?: string;
  checkInDateTime: firebase.default.firestore.Timestamp;
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
