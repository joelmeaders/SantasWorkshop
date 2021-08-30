import {DocumentData} from '@google-cloud/firestore';

export interface CompletedRegistration {
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  code: string;
  date: string;
  time: string;
  dateTime: string;
  zipCode: string;
  children: any[];
}

export const isRegistrationComplete = (data: CompletedRegistration): boolean => {
  if (!data) return false;
  if (!data.customerId) return false;
  if (!data.email) return false;
  if (!data.firstName) return false;
  if (!data.lastName) return false;
  if (!data.fullName) return false;
  if (!data.code) return false;
  if (!data.date) return false;
  if (!data.time) return false;
  if (!data.dateTime) return false;
  if (!data.zipCode) return false;
  if (!data.children || !data.children.length) return false;
  return true;
};

export const getAllRegistrationData = (data: DocumentData): CompletedRegistration => {
  return {
    customerId: data.id,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    fullName: data.fullName,
    code: data.code,
    date: data.date,
    time: data.time,
    dateTime: data.formattedDateTime,
    zipCode: data.zipCode,
    children: data.children,
  };
};
