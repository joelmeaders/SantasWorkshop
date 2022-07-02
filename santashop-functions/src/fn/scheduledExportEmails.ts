import * as admin from 'firebase-admin';
import { parseAsync } from 'json2csv';
import { v4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

admin.initializeApp();

export default async () => {
	// gets the documents from the firestore collection
	const applicationsSnapshot = await admin
		.firestore()
		.collection('users')
		.get();

	const applications = applicationsSnapshot.docs.map((doc) => doc.data());

	// csv field headers
	const fields = ['emailAddress'];

	// get csv output
	const output = await parseAsync(applications, { fields });

	// generate filename
	const dateTime = new Date().toISOString().replace(/\W/g, '');
	const filename = `emailList_${dateTime}.csv`;

	const tempLocalFile = path.join(os.tmpdir(), filename);

	return new Promise((resolve, reject) => {
		// write contents of csv into the temp file
		fs.writeFile(tempLocalFile, output, (error) => {
			if (error) {
				reject(error);
				return;
			}
			const bucket = admin.storage().bucket();

			// upload the file into the current firebase project default bucket
			bucket
				.upload(tempLocalFile, {
					// Workaround: firebase console not generating token for files
					// uploaded via Firebase Admin SDK
					// https://github.com/firebase/firebase-admin-node/issues/694
					metadata: {
						metadata: {
							firebaseStorageDownloadTokens: v4(),
						},
					},
				})
				.then(() => resolve(undefined))
				.catch((errorr) => reject(errorr));
		});
	});
};
