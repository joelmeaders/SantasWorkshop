import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { HttpsError } from 'firebase-functions/v1/https';
import { IOnboardUser, IUser, IRegistration, COLLECTION_SCHEMA, IDateTimeSlot } from '../../../santashop-models/src/lib/models';
import { generateId } from '../utility/id-generation';
import { generateQrCode } from '../utility/qrcodes';

admin.initializeApp();

export default async (data: IOnboardUser): Promise<string | HttpsError> => {
  // TODO: Add recaptcha integration

  const newUserAccount = await admin
    .auth()
    .createUser({
      email: data.emailAddress.toLowerCase(),
      password: data.password,
      disabled: false,
      displayName: `${data.firstName} ${data.lastName}`,
    })
    .catch((error) => {
      console.error(error);
      throw handleAuthError(error);
    });

  try {
    if ((await dateTimSlotCollection.get()).empty) {
      await testData();
    }
  } catch (e) {
    console.log(e);
  }

  const acceptedLegal = data.legal as Date;

  const user: IUser = {
    firstName: data.firstName,
    lastName: data.lastName,
    emailAddress: data.emailAddress.toLowerCase(),
    zipCode: data.zipCode,
    acceptedTermsOfService: acceptedLegal,
    acceptedPrivacyPolicy: acceptedLegal,
    version: 1
  };

  const registration: IRegistration = {
    uid: newUserAccount.uid,
    firstName: data.firstName,
    lastName: data.lastName,
    emailAddress: data.emailAddress.toLowerCase(),
    zipCode: data.zipCode,
    qrcode: generateId(8),
  };

  const userDocument = admin
    .firestore()
    .doc(`${COLLECTION_SCHEMA.users}/${newUserAccount.uid}`);

  const registrationDocument = admin
    .firestore()
    .doc(`${COLLECTION_SCHEMA.registrations}/${newUserAccount.uid}`);

  const batch = admin.firestore().batch();

  batch.create(userDocument, user);
  batch.create(registrationDocument, registration);

  // TODO: This whole file is super shitty and fragile
  return batch
    .commit()
    .then(async () => {
      await generateQrCode(newUserAccount.uid, registration.qrcode!);
    })
    .then(() => {
      return Promise.resolve(newUserAccount.uid);
    })
    .catch((error) => {
      console.log('Error creating account records in batch process', error);
      return new functions.https.HttpsError(
        'internal',
        'Account created but something else went wrong',
        JSON.stringify(error)
      );
    });
};

const dateTimSlotCollection = admin
  .firestore()
  .collection(`${COLLECTION_SCHEMA.dateTimeSlots}`);

// TODO: Remove this - sample data only
const testData = async () => {
  const collection = dateTimSlotCollection;
  const programYear = 2021;

  const demoValues: IDateTimeSlot[] = [
    {
      programYear: programYear,
      dateTime: new Date('12-10-2021 09:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-10-2021 10:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-10-2021 11:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-10-2021 12:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-10-2021 13:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-10-2021 14:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-10-2021 15:00'),
      maxSlots: 40,
      enabled: true,
    },

    {
      programYear: programYear,
      dateTime: new Date('12-11-2021 09:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-11-2021 10:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-11-2021 11:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-11-2021 12:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-11-2021 13:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-11-2021 14:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-11-2021 15:00'),
      maxSlots: 40,
      enabled: true,
    },

    {
      programYear: programYear,
      dateTime: new Date('12-12-2021 09:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-12-2021 10:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-12-2021 11:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-12-2021 12:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-12-2021 13:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-12-2021 14:00'),
      maxSlots: 40,
      enabled: true,
    },
    {
      programYear: programYear,
      dateTime: new Date('12-12-2021 15:00'),
      maxSlots: 40,
      enabled: true,
    },
  ];

  demoValues.forEach(async (v) => {
    await collection.add(v);
  });
  return Promise.resolve();
};

const handleAuthError = (error: any) => {
  switch (error.code) {
    case 'auth/email-already-exists':
      return new functions.https.HttpsError(
        'already-exists',
        error.code,
        error.message
      );
    default:
      return new functions.https.HttpsError(
        'unknown',
        error.code,
        error.message
      );
  }
};
