export interface IChild {
  id?: number;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  ageGroup?: AgeGroup;
  toyType?: ToyType;
  programYearAdded?: number;
  enabled: boolean;
  error?: string
}

export enum AgeGroup {
  age02 = '0-2',
  age35 = '3-5',
  age68 = '6-8',
  age911 = '9-11'
}

export enum ToyType {
  infant = 'infants',
  boy = 'boys',
  girl = 'girls'
}

export interface IChildAlt {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  ageGroup: string;
  toyType: string;
  programYearAdded: number;
  enabled: boolean;
}
