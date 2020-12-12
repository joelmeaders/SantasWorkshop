import * as functions from 'firebase-functions';
import * as sendgrid from '@sendgrid/mail';

let MAIL_API_KEY: string;

export default async (
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext
) => {

  if (!change.after.exists) {
    // Deleted, exit
    console.log('deleted')
    return null;
  }

  if (!MAIL_API_KEY) {
    MAIL_API_KEY = functions.config().sendgrid.key;
  }

  sendgrid.setApiKey(MAIL_API_KEY);

  const oldDocument: any = change.before.exists
    ? change.before.data()
    : undefined;

  const document: any = change.after.data();
  const code = document.code;
  const name = document.firstName;
  const email = document.email;
  const formattedDateTime = document.formattedDateTime;

  let isNewCode = false;

  if (!!oldDocument && !!oldDocument.code) {
    isNewCode = oldDocument.code !== code;
  } else {
    isNewCode = false;
  }

  const isResend = !oldDocument?.resend && !!document.resend; 

  // Don't proceed
  if (!isResend && (!code || !email?.length || !isNewCode)) {
    return;
  }

  console.log(`sending email to ${email}`);

  const msg = {
    to: email,
    from: `noreply@denversantaclausshop.org`,
    templateId: 'd-5a8e2828b2c64284965bc4e244026abf',
    dynamic_template_data: {
      registrationCode: code,
      dateTime: formattedDateTime,
      displayName: name,
    },
  };

  return sendgrid.send(msg);
};
