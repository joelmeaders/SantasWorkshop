import { Timestamp } from 'firebase/firestore';
import { IRegistration } from '../dist/santashop-models';

export const mockRegistrations = (id?: string) => ({
	complete: {
		mockRegistration1: {
			uid: id,
			children: [{ id: '1' }, { id: '2' }] as any[],
			dateTimeSlot: { id: '1', dateTime: Timestamp.now() as any },
			registrationSubmittedOn: new Date(),
		} as IRegistration,
	},

	incomplete: {
		noRegistrationSubmittedOn: {
			uid: id,
			children: [{ id: '1' }, { id: '2' }] as any[],
			dateTimeSlot: { id: '1', dateTime: Timestamp.now() as any },
		} as IRegistration,
		noChildren: {
			uid: id,
			dateTimeSlot: { id: '1', dateTime: Timestamp.now() as any },
			registrationSubmittedOn: new Date(),
		} as IRegistration,
		withChildrenError: {
			uid: id,
			children: [
				{ id: '1' },
				{ id: '2', error: 'missing age or something' },
			] as any[],
			dateTimeSlot: { id: '1', dateTime: Timestamp.now() as any },
		} as IRegistration,
	},
});
