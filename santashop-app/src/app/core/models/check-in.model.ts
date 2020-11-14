import { BaseEntity } from '@app/core/models/base/base-entity';

export class ICheckIn extends BaseEntity {
  customerId?: string;
  registrationCode?: string;
  checkInDateTime: Date = new Date();
  children: ICheckInChildren[];
  stats: ICheckInStats;
}

export interface ICheckInChildren {
  toyType: string;
  ageGroup: string;
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
}
