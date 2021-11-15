import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { HttpsError, CallableContext } from 'firebase-functions/v1/https';
import { IAuth, COLLECTION_SCHEMA, IUser, IChild, IRegistration } from '../../../santashop-models/src/lib/models';
import { getAgeFromDate, getAgeGroupFromAge } from '../utility/dates';
import { generateQrCode } from '../utility/qrcodes';

admin.initializeApp();

export default async (
  data: IAuth,
  context: CallableContext
): Promise<boolean | HttpsError> => {

  const uid = context.auth?.uid;

  const emailData = {
    emailAddress: context.auth?.token.email?.toLowerCase()
  };

  if (!uid || !emailData.emailAddress) {
    return new HttpsError('not-found', 'uid or email null');
  }

  // Get old customers document
  const customersDocRef = admin.firestore()
    .doc(`${'customers'}/${uid}`);

  const customer = await customersDocRef.get().then(snapshot => {
    if (snapshot.exists) {
      return snapshot.data() as any;
    } else {
      return new HttpsError('not-found', `record not found in collection customers: ${uid}`);
    }
  });

  // Set up user doc
  const userDocumentRef = admin.firestore()
    .doc(`${COLLECTION_SCHEMA.users}/${uid}`);

  let parsedZipCode: number;

  try {
    const leftSide = (customer.zipCode as string).substr(0,5);
    parsedZipCode = Number.parseInt(leftSide);
  }
  catch {
    parsedZipCode = 0;
  }

  const newUser: IUser = {
    acceptedPrivacyPolicy: new Date(),
    acceptedTermsOfService: new Date(),
    emailAddress: emailData.emailAddress,
    firstName: customer.firstName,
    lastName: customer.lastName,
    zipCode: parsedZipCode,
    version: 1
  }

  // Get children for user
  const childDocsQueryRef = admin.firestore()
    .collection('children').where('parentId', '==', uid);

  const childDocs: admin.firestore.DocumentReference<admin.firestore.DocumentData>[] = [];

  const children = await childDocsQueryRef.get().then(snapshot => {
      if (snapshot.empty) {
        return null;
      } else {
        const childrenList: Partial<IChild>[] = [];

        snapshot.forEach(doc => {

          childDocs.push(doc.ref);

          const childData = doc.data();

          const child: Partial<IChild> = {
            id: Math.floor(Math.random() * (999999 + 1)),
            firstName: childData.firstName,
            dateOfBirth: new Date(Date.parse(childData.dateOfBirth)),
            ageGroup: childData.ageGroup,
            toyType: childData.toyType === 'infant' ? 'infants' : childData.toyType,
            programYearAdded: 2020,
            enabled: true
          }

          const childAge = getAgeFromDate(child.dateOfBirth!, new Date('12/10/2021'));

          if (child.toyType === 'infants' && childAge > 2) {
            delete child.toyType;
            child.error = `ERROR! Edit ${child.firstName} to fix.`;
          }

          try {
            child.ageGroup = getAgeGroupFromAge(childAge);
            childrenList.push(child);
          }
          catch {
            // don't worry about this child, too old
          }
        });

        return childrenList;
      }
    });

  // Set up new registration doc
  const registrationDocRef = admin.firestore()
    .doc(`${COLLECTION_SCHEMA.registrations}/${uid}`);

  const oldRegistration = await registrationDocRef.get().then(snapshot => {
    if (snapshot.exists) {
      return snapshot.data() as any;
    } else {
      return new HttpsError('not-found', `record not found in collection registrations: ${uid}`);
    }
  });

  const registration: IRegistration = {
    uid: uid,
    qrcode: oldRegistration.code,
    firstName: customer.firstName,
    lastName: customer.lastName,
    emailAddress: emailData.emailAddress,
    programYear: 2021,
    includedInCounts: false,
    zipCode: parsedZipCode,
  };

  // Add children to registration doc
  if (children?.length) {
    registration.children = children as IChild[];
  }

  // Set up registrationSearchIndex doc
  const indexDocRef = admin.firestore()
    .doc(`${COLLECTION_SCHEMA.registrationSearchIndex}/${uid}`);
  
  return admin.firestore().runTransaction(transaction => {

    transaction.set(userDocumentRef, newUser, { merge: true });
    transaction.set(registrationDocRef, registration);
    transaction.set(indexDocRef, emailData, { merge: true });
    
    transaction.delete(customersDocRef);

    childDocs.forEach((childDoc) => { 
      transaction.delete(childDoc); 
    });

    return Promise.resolve(true);


  }).then(async () => {
    await generateQrCode(uid, registration.qrcode!);
    return Promise.resolve(true);
  }).catch((error) => {
    console.error(error)
    return new functions.https.HttpsError(
      'internal',
      `Error updating profile ${context.auth?.uid} to version 1`,
      JSON.stringify(error)
    );
  });
};
