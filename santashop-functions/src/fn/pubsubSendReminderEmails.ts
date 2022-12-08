/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Registration } from '../../../santashop-models/src/public-api';
import * as formatDateTime from 'dateformat';
import { Timestamp } from 'firebase-admin/firestore';

admin.initializeApp();

const mailchimpClient = require('@mailchimp/mailchimp_transactional')(
	functions.config().mailchimp.key
);

/**
 * This method loads rescheduled registrations and updates
 * dateTimeSlots based on the values within.
 *
 * @returns
 */
export default async (): Promise<string> => {
	// Load all rescheduled registrations
	const registrations: Registration[] = await loadRegistrations();
	if (!registrations.length) return Promise.resolve('No registrations');

	for (const registration of registrations) {
		if (!isValid(registration)) {
			console.error(`registration is invalid: ${registration.uid}`);
			continue;
		}

		const message = getMessage(registration);
		const response = await sendEmail(message);

		if (response[0].status === 'sent') {
			await updateDocument(registration.uid!.toString());
		} else {
			const failure = {
				...response[0],
			};
			console.error(
				`failed sending email to: ${registration.uid}`,
				JSON.stringify(failure)
			);
		}
	}

	return Promise.resolve('Sent reminder emails');
};

const sendEmail = (message: any) => {
	return mailchimpClient.messages.sendTemplate({
		template_name: 'event-reminder',
		template_content: [],
		message: message,
	});
};

const getMessage = (registration: Registration) => ({
	to: [
		{
			email: registration.emailAddress,
			type: 'to',
		},
	],
	merge_language: 'mailchimp',
	global_merge_vars: [
		{ name: 'NAME', content: registration.firstName },
		{
			name: 'QRCODE_URL',
			content: `https://storage.googleapis.com/santas-workshop-193b5.appspot.com/registrations/${registration.uid}.png`,
		},
		{ name: 'CODE', content: registration.qrcode },
		{
			name: 'DATETIME',
			content: formattedDateTime(registration.dateTimeSlot?.dateTime),
		},
	],
});

const formattedDateTime = (inputDateTime: any) => {
	const dateTime = new Timestamp(
		inputDateTime._seconds,
		inputDateTime._nanoseconds
	).toDate();
	const dateZ = dateTime.toLocaleString('en-US', { timeZone: 'MST' });
	return formatDateTime.default(dateZ, 'dddd, mmmm d, h:MM TT');
};

const isValid = (registration: Registration): boolean => {
	if (!registration.uid?.length) return false;
	if (!registration.firstName?.length) return false;
	if (!registration.emailAddress?.length) return false;
	if (!registration.qrcode?.length) return false;
	if (!registration.dateTimeSlot?.dateTime) return false;
	return true;
};

const updateDocument = async (uid: string) => {
	const doc = admin.firestore().collection('registrations').doc(uid);
	await doc.set({ reminderEmailSentOn: new Date() }, { merge: true });
};

const registrationQuery = (pageSize = 100) =>
	admin
		.firestore()
		.collection('registrations')
		.where('registrationSubmittedOn', '!=', '')
		.where('reminderEmailSentOn', '==', false)
		.limit(pageSize);

const loadRegistrations = async (): Promise<Registration[]> => {
	let allRegistrations: Registration[] = [];
	const snapshotDocs = await registrationQuery().get();

	snapshotDocs.docs.forEach((doc) => {
		const reg = {
			...doc.data(),
		} as Registration;

		allRegistrations = allRegistrations.concat(reg);
	});

	return allRegistrations;
};
