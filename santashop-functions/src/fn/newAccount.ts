import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as qrcode from 'qrcode';
import {
  COLLECTION_SCHEMA,
  IOnboardUser,
  IUser,
  IRegistration,
  IDateTimeSlot,
} from '../../../santashop-core/src';
import { HttpsError } from 'firebase-functions/v1/https';

admin.initializeApp();

export default async (data: IOnboardUser): Promise<string | HttpsError> => {
  // TODO: Add recaptcha integration

  const newUserAccount = await admin
    .auth()
    .createUser({
      email: data.emailAddress,
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
    emailAddress: data.emailAddress,
    zipCode: data.zipCode,
    acceptedTermsOfService: acceptedLegal,
    acceptedPrivacyPolicy: acceptedLegal,
  };

  const registration: IRegistration = {
    uid: newUserAccount.uid,
    firstName: data.firstName,
    lastName: data.lastName,
    emailAddress: data.emailAddress,
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

function generateQrCode(uid: string, code: string): Promise<any> {
  const storage = admin
    .storage()
    .bucket('gs://santas-workshop-193b5.appspot.com');
  const imageToCreate = storage.file(`registrations/${uid}.png`);
  const fileStream = imageToCreate.createWriteStream({
    public: true,
    contentType: 'auto',
    resumable: false,
  });

  return qrcode.toFileStream(fileStream, code, {
    errorCorrectionLevel: 'high',
    width: 600,
    margin: 3,
  });
}

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

const generateId = (length: number): string => {
  const customLib = lib.alpha.concat(lib.number);
  const n: number = customLib.length;

  const generatedId: string[] = [];

  while (length > 0) {
    generatedId.push(customLib[Math.round(Math.random() * n)]);
    length -= 1;
  }

  return generatedId.join('');
};

interface ILib {
  alpha: string[];
  number: string[];
}

const lib: ILib = {
  alpha: [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'J',
    'K',
    'L',
    'M',
    'N',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
  ],
  number: ['2', '3', '4', '5', '6', '7', '8', '9'],
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