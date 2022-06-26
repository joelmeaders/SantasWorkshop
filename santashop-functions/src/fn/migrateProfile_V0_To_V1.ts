import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { HttpsError, CallableContext } from 'firebase-functions/v1/https';
import {
  IAuth,
  COLLECTION_SCHEMA,
  IUser,
  IChild,
  IRegistration,
} from '../../../santashop-models/src/lib/models';
import { getAgeFromDate, getAgeGroupFromAge } from '../utility/dates';
import { generateId } from '../utility/id-generation';
import { generateQrCode } from '../utility/qrcodes';

admin.initializeApp();

export default async (
  data: IAuth,
  context: CallableContext
): Promise<boolean | HttpsError> => {
  const uid = context.auth?.uid;

  const emailData = {
    emailAddress: context.auth?.token.email?.toLowerCase(),
  };

  if (!uid || !emailData.emailAddress) {
    console.error(
      new Error(
        `uid (${uid ?? ''}) or email (${emailData?.emailAddress ?? ''}) null`
      )
    );
    throw new HttpsError('not-found', 'uid or email null');
  }

  // Get old customers document
  const customersDocRef = admin.firestore().doc(`${'customers'}/${uid}`);

  const customer = await customersDocRef.get().then((snapshot) => {
    if (snapshot.exists) {
      return snapshot.data() as any;
    } else {
      console.error(
        new Error(`record not found in collection customers: ${uid}`)
      );
      throw new HttpsError(
        'not-found',
        `record not found in collection customers: ${uid}`
      );
    }
  });

  // Get old registration
  const registrationDocRef = admin
    .firestore()
    .doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);

  const oldRegistration = await registrationDocRef.get().then((snapshot) => {
    if (snapshot.exists) {
      return snapshot.data() as any;
    } else {
      console.error(
        'not-found',
        new Error(`record not found in collection registrations: ${uid}`)
      );
      throw new HttpsError(
        'not-found',
        `record not found in collection registrations: ${uid}`
      );
    }
  });

  // Set up user doc
  const userDocumentRef = admin
    .firestore()
    .doc(`${COLLECTION_SCHEMA.users}/${uid}`);

  let parsedZipCode: number;

  try {
    const leftSide = (customer.zipCode as string).substr(0, 5);
    parsedZipCode = Number.parseInt(leftSide);
  } catch {
    parsedZipCode = 0;
  }

  const newUser: IUser = {
    acceptedPrivacyPolicy: new Date(),
    acceptedTermsOfService: new Date(),
    emailAddress: emailData.emailAddress,
    firstName: customer.firstName ?? oldRegistration.firstName ?? 'ERROR',
    lastName: customer.lastName ?? oldRegistration.lastName ?? 'ERROR',
    zipCode: parsedZipCode,
    version: 1,
  };

  // Get children for user
  const childDocsQueryRef = admin
    .firestore()
    .collection('children')
    .where('parentId', '==', uid);

  const childDocs: admin.firestore.DocumentReference<admin.firestore.DocumentData>[] =
    [];

  const children = await childDocsQueryRef.get().then((snapshot) => {
    if (snapshot.empty) {
      return null;
    } else {
      const childrenList: Partial<IChild>[] = [];

      snapshot.forEach((doc) => {
        childDocs.push(doc.ref);

        const childData = doc.data();

        const child: Partial<IChild> = {
          id: Math.floor(Math.random() * (999999 + 1)),
          firstName: childData.firstName,
          dateOfBirth: new Date(Date.parse(childData.dateOfBirth)),
          ageGroup: childData.ageGroup,
          toyType:
            childData.toyType === 'infant' ? 'infants' : childData.toyType,
          programYearAdded: 2020,
          enabled: true,
        };

        const childAge = getAgeFromDate(
          child.dateOfBirth!,
          new Date('12/10/2021')
        );

        if (child.toyType === 'infants' && childAge > 2) {
          delete child.toyType;
          child.error = `ERROR! Edit ${child.firstName} to fix.`;
        }

        try {
          child.ageGroup = getAgeGroupFromAge(childAge);
          childrenList.push(child);
        } catch {
          // don't worry about this child, too old
        }
      });

      return childrenList;
    }
  });

  // Set up new registration doc
  const registration: IRegistration = {
    uid: uid,
    qrcode: oldRegistration.code ?? generateId(8),
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    emailAddress:
      emailData.emailAddress ?? oldRegistration.email?.toLower() ?? 'ERROR',
    programYear: 2021,
    includedInCounts: false,
    zipCode: parsedZipCode,
  };

  if (
    registration.firstName === 'ERROR' ||
    registration.lastName === 'ERROR' ||
    registration.emailAddress === 'ERROR'
  ) {
    console.error(
      context.auth?.token.email,
      new Error(`MIGRATION FAILED FOR ${uid}`)
    );
    throw new HttpsError('failed-precondition', `MIGRATION FAILED FOR ${uid}`);
  }

  // Add children to registration doc
  if (children?.length) {
    registration.children = children as IChild[];
  }

  // Set up registrationSearchIndex doc
  const indexDocRef = admin
    .firestore()
    .doc(`${COLLECTION_SCHEMA.registrationSearchIndex}/${uid}`);

  const indexData = {
    code: registration.qrcode!,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    emailAddress: registration.emailAddress,
    zip: parsedZipCode.toString(),
    customerId: uid,
  };

  await admin.auth().updateUser(uid, {
    displayName: `${newUser.firstName} ${newUser.lastName}`,
  });

  const batch = admin.firestore().batch();

  batch.set(userDocumentRef, newUser, { merge: true });
  batch.set(registrationDocRef, registration);
  batch.set(indexDocRef, indexData, { merge: true });
  batch.delete(customersDocRef);

  childDocs.forEach((childDoc) => {
    batch.delete(childDoc);
  });

  return batch
    .commit()
    .then(async () => {
      await generateQrCode(uid, registration.qrcode!);
      return Promise.resolve(true);
    })
    .catch((error) => {
      console.error(
        `Error updating profile ${context.auth?.uid} to version 1`,
        error
      );
      throw new functions.https.HttpsError(
        'internal',
        `Error updating profile ${context.auth?.uid} to version 1`,
        JSON.stringify(error)
      );
    });
};
