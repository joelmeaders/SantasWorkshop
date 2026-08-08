export const COLLECTION_SCHEMA = {
	checkins: 'checkins',
	cancellations: 'cancellations',
	users: 'users',
	registrations: 'registrations',
	editedRegistrations: 'editedregistrations',
	onSiteRegistrations: 'onsiteregistrations',
	children: 'children',
	dateTimeSlots: 'dateTimeSlots',
	emailTemplates: 'emailTemplates',
	registrationSearchIndex: 'registrationsearchindex',
	registrationScanAttempts: 'registrationScanAttempts',
	registrationScanRiskSummaries: 'registrationScanRiskSummaries',
	stats: 'stats',
	tmpRegistrationEmails: 'tmp_registrationemails',
	tmpResendRegistrationEmails: 'tmp_registrationemails2',
	parameters: 'parameters',
	staff: 'staff',
	ownerOperationPreviews: 'ownerOperationPreviews',
	ownerOperations: 'ownerOperations',
	ownerOperationLocks: 'ownerOperationLocks',
	// campaigns: (organizationId: string): string =>
	//   `${COLLECTION_SCHEMA.organizations}/${organizationId}/campaigns`
};
