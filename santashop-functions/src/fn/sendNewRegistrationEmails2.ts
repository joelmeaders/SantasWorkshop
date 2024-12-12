import {
	SendTemplatedEmailCommand,
	SendTemplatedEmailCommandOutput,
	SESClient,
	SESClientConfig,
} from '@aws-sdk/client-ses';
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { COLLECTION_SCHEMA } from '../../../santashop-models/src';

admin.initializeApp();

const region = 'us-west-2';
const credentials = {
	accessKeyId: process.env.AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
let sesClient: SESClient | undefined = undefined;

const createReminderEmailCommand = (
	messageDetails: any,
	toEmailAddress: string,
	template = 'dscs-registration-confirmation-v1',
) => {
	return new SendTemplatedEmailCommand({
		Destination: { ToAddresses: [toEmailAddress] },
		TemplateData: JSON.stringify(messageDetails),
		Source: 'noreply@denversantaclausshop.org',
		Template: template,
		ReturnPath: 'admin@denversantaclausshop.org',
	});
};

export default async (docChange: functions.firestore.QueryDocumentSnapshot) => {
	const document: any = docChange.data();
	const uid = docChange.id;
	const code = document.code;
	const qrCode = `https://storage.googleapis.com/santas-workshop-193b5.appspot.com/registrations/${uid}.png`;
	const firstName = document.name;
	const email = document.email;
	const dateTime = document.formattedDateTime;
	const template = document.template ?? 'dscs-registration-confirmation-v1';

	const messageDetails = {
		firstName: firstName,
		qrCodeUrl: qrCode,
		code: code,
		dateTime: dateTime,
	};

	if (!sesClient)
		sesClient = new SESClient({ credentials, region } as SESClientConfig);

	const sendReminderEmailCommand = createReminderEmailCommand(
		messageDetails,
		email,
		template,
	);

	let response: SendTemplatedEmailCommandOutput | undefined = undefined;

	try {
		response = await sesClient.send(sendReminderEmailCommand);
		console.log('Successfully sent template email', response);
	} catch (err) {
		response = undefined;
		console.log('Failed to send template email', err);
	}

	const emailDocRef = admin
		.firestore()
		.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${uid}`);

	if ((response?.$metadata.httpStatusCode ?? 999) <= 300) {
		await emailDocRef.delete();
	} else {
		console.log(response);
		const failure = {
			...response,
		};
		await emailDocRef.set({ rejected: failure }, { merge: true });
	}

	Promise.resolve();
};
