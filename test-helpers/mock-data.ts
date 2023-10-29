import { Timestamp } from 'firebase/firestore';
import {
	AgeGroup,
	Child,
	Registration,
	User,
	ToyType,
} from '../santashop-models/src/public-api';

export const mockUsers = (id?: string) => ({
	user1: {
		uid: id,
		firstName: 'Jesse',
		lastName: 'Doe',
		emailAddress: 'jesse.doe@gmail.com',
		zipCode: '90210',
		acceptedTermsOfService: new Date(),
		acceptedPrivacyPolicy: new Date(),
		version: 1,
		manuallyMigrated: false,
		newsletter: false,
	} as User,
});

export const mockRegistrations = (id?: string) => ({
	complete: {
		mockRegistration1: {
			uid: id,
			children: [{ id: '1' }, { id: '2' }] as any[],
			dateTimeSlot: { id: '1', dateTime: Timestamp.now() as any },
			registrationSubmittedOn: new Date(),
		} as Registration,
	},

	incomplete: {
		noRegistrationSubmittedOn: {
			uid: id,
			children: [{ id: '1' }, { id: '2' }] as any[],
			dateTimeSlot: { id: '1', dateTime: Timestamp.now() as any },
		} as Registration,
		noChildren: {
			uid: id,
			dateTimeSlot: { id: '1', dateTime: Timestamp.now() as any },
			registrationSubmittedOn: new Date(),
		} as Registration,
		withChildrenError: {
			uid: id,
			children: [
				{ id: '1' },
				{ id: '2', error: 'missing age or something' },
			] as any[],
			dateTimeSlot: { id: '1', dateTime: Timestamp.now() as any },
		} as Registration,
	},
});

export const mockChildren = {
	valid: {
		infant: {
			id: 1,
			firstName: 'John',
			lastName: 'Doe',
			dateOfBirth: new Date(),
			ageGroup: AgeGroup.age02,
			toyType: ToyType.infant,
			programYearAdded: new Date().getFullYear(),
			enabled: true,
			error: undefined,
		} as Child,
		age35: {
			id: 2,
			firstName: 'Jane',
			lastName: 'Doe',
			dateOfBirth: new Date(new Date().getFullYear() - 4, 2, 1),
			ageGroup: AgeGroup.age35,
			toyType: ToyType.girl,
			programYearAdded: new Date().getFullYear(),
			enabled: true,
			error: undefined,
		} as Child,
		age68: {
			id: 3,
			firstName: 'Jesse',
			lastName: 'Doe',
			dateOfBirth: new Date(new Date().getFullYear() - 7, 2, 1),
			ageGroup: AgeGroup.age68,
			toyType: ToyType.boy,
			programYearAdded: new Date().getFullYear(),
			enabled: true,
			error: undefined,
		} as Child,
		age911: {
			id: 3,
			firstName: 'Jesse',
			lastName: 'Doe',
			dateOfBirth: new Date(new Date().getFullYear() - 10, 2, 1),
			ageGroup: AgeGroup.age911,
			toyType: ToyType.girl,
			programYearAdded: new Date().getFullYear(),
			enabled: true,
			error: undefined,
		} as Child,
	},
};
