export interface IChild {
  id?: number;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  ageGroup?: AgeGroup;
  toyType?: ToyType;
  programYearAdded?: number;
  enabled: boolean;
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
