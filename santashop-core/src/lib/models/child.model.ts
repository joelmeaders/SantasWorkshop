export interface IChild {
  id?: number;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  ageGroup?: string;
  programYearAdded?: number;
  enabled: boolean;
}