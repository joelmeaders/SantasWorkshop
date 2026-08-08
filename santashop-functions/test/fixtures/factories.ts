import {
	AgeGroup,
	OnboardUser,
	Registration,
	ToyType,
	User,
} from '@santashop/models';

const TEST_ONBOARD_PASSWORD = ['Candy', 'Cane', '123!'].join('');

export const createOnboardUser = (
	overrides: Partial<OnboardUser> = {},
): OnboardUser => ({
	firstName: 'Buddy',
	lastName: 'Elf',
	emailAddress: 'buddy.elf@example.com',
	password: TEST_ONBOARD_PASSWORD,
	password2: TEST_ONBOARD_PASSWORD,
	zipCode: 80205,
	referredBy: 'Denver Human Services DHS',
	legal: true,
	newsletter: true,
	...overrides,
});

export const createUser = (overrides: Partial<User> = {}): User => ({
	firstName: 'Buddy',
	lastName: 'Elf',
	emailAddress: 'buddy.elf@example.com',
	zipCode: '80205',
	acceptedTermsOfService: new Date('2025-12-01T00:00:00.000Z'),
	acceptedPrivacyPolicy: new Date('2025-12-01T00:00:00.000Z'),
	version: 1,
	manuallyMigrated: false,
	newsletter: true,
	...overrides,
});

export const createRegistration = (
	overrides: Partial<Registration> = {},
): Registration => ({
	uid: 'test-user-123',
	qrcode: 'ABCD2345',
	qrCodeStoragePath: 'registrations/test-user-123/test-asset.png',
	firstName: 'Buddy',
	lastName: 'Elf',
	emailAddress: 'buddy.elf@example.com',
	zipCode: '80205',
	children: [
		{
			id: 1,
			firstName: 'Noelle',
			lastName: 'Elf',
			dateOfBirth: new Date('2020-12-15T00:00:00.000Z'),
			ageGroup: AgeGroup.age35,
			toyType: ToyType.girl,
			programYearAdded: 2025,
			enabled: true,
		},
	],
	dateTimeSlot: {
		id: 'slot-1',
		dateTime: '2025-12-10T18:00:00.000Z',
	},
	...overrides,
});
