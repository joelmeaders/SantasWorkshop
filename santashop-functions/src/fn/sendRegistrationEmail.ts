import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { COLLECTION_SCHEMA } from '../../../santashop-models/src/lib/models';

const mailchimpClient = require('@mailchimp/mailchimp_transactional')(
  functions.config().mailchimp.key
);

export default async (
  change: functions.firestore.QueryDocumentSnapshot
) => {

  const document: any = change.data();
  const code = document.code;
  const qrCode = `https://storage.googleapis.com/santas-workshop-193b5.appspot.com/registrations/${change.after.id}.png`;
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
    message: message
  });

  const emailDocRef = admin
      .firestore()
      .doc(`${COLLECTION_SCHEMA.tmpRegistrationEmails}/${change.id}`);

  if (response.status === 'sent') {
    await emailDocRef.delete();
  } else {
    const failure = {
      ...response
    };
    delete failure.email;
    await emailDocRef.set(failure, {merge: true});
  }
};
