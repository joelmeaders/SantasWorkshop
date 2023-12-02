/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { isRegistrationComplete } from '../utility/registrations';
import { CallableContext, HttpsError } from 'firebase-functions/v1/https';
import * as formatDateTime from 'dateformat';
import {
	COLLECTION_SCHEMA,
	Registration,
} from '../../../santashop-models/src';
import { Timestamp } from 'firebase-admin/firestore';

admin.initializeApp();

export default async (
	data: { customerId: string },
	context: CallableContext,
): Promise<boolean | HttpsError> => {

    const recordRef = admin.firestore()
        .doc(`${COLLECTION_SCHEMA.registrations}/${data.customerId}`);

    const record = (await recordRef.get()).data() as Registration;

	registrationCompleteGuard(record);
	adminOrOwnerGuard(record, context);

	// Email Record Reference
	const emailDocRef = admin.firestore()
		.doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${record.uid}`);

	let dateTime: any;

	dateTime = record.dateTimeSlot?.dateTime as any as Timestamp;
	const tmp = dateTime.toDate();
	const dateZ = tmp.toLocaleString('en-US', { timeZone: 'MST' });
	dateTime = formatDateTime.default(dateZ, 'dddd, mmmm d, h:MM TT');

	const emailDoc = {
		code: record.qrcode,
		email: record.emailAddress,
		name: record.firstName,
		formattedDateTime: dateTime,
	};

    await emailDocRef.set(emailDoc, { merge: true });

	return true;
};
function registrationCompleteGuard(record: Registration) {
    if (!isRegistrationComplete(record)) {
        console.error(
            new Error(
                'Registration incomplete. Unable to send registration email.'
            )
        );
        throw new functions.https.HttpsError(
            'failed-precondition',
            '-10',
            'Incomplete registration. Cannot continue.'
        );
    }
}

function adminOrOwnerGuard(record: Registration, context: functions.https.CallableContext) {
    if (!context.auth?.token?.admin && record.uid !== context.auth?.uid) {
        console.error(
            new Error(
                `${context.auth?.uid} attempted to update registration for uid ${record.uid}`
            )
        );
        throw new functions.https.HttpsError(
            'permission-denied',
            '-99',
            'You can only update your own records'
        );
    }
}

