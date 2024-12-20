import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { COLLECTION_SCHEMA } from '../../../santashop-models/src';

admin.initializeApp();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mailchimpClient = require('@mailchimp/mailchimp_transactional')(
	functions.config().mailchimp.key,
);

export default async (
	change: functions.Change<functions.firestore.DocumentSnapshot>,
) => {
	const document: any = change.after.data();
	const uid = change.after.id;

	if (document.rejected) {
		throw new Error(`Email for ${uid} previously failed`);
	}

	const code = document.code;
	const qrCode = `https://storage.googleapis.com/santas-workshop-193b5.appspot.com/registrations/${uid}.png`;
	const firstName = document.name;
	const email = document.email;
	const dateTime = document.formattedDateTime;

	const message = {
		to: [
			{
				email: email,
				type: 'to',
			},
		],
		merge_language: 'mailchimp',
		global_merge_vars: [
			{ name: 'NAME', content: firstName },
			{ name: 'QRCODE_URL', content: qrCode },
			{ name: 'CODE', content: code },
			{ name: 'DATETIME', content: dateTime },
		],
	};

	const response = await mailchimpClient.messages.sendTemplate({
		template_name: 'registration-confirmation',
		template_content: [],
		message: message,
	});

	const emailDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${uid}`);

	if (response[0].status === 'sent') {
		await emailDocRef.delete();
	} else {
		const failure = {
			...response[0],
		};
		await emailDocRef.set({ rejected: failure }, { merge: true });
	}
};
