// import * as admin from 'firebase-admin';
// import { CallableContext } from 'firebase-functions/lib/providers/https';

// try {
//   admin.initializeApp();
// } catch { }

// export default async (
//   request: any,
//   context: CallableContext
// ) => {

//   var registrations = admin.firestore().collection('registrations')
//     .where('date', '>', 0)

//   return admin.firestore().doc(`parameters/admin`).get()
//     .then((response) => {
//       const adminUsers = response.data()?.adminusers as string[];
//       return adminUsers.findIndex((user) => user === context.auth?.uid) > -1;
//     });
// }