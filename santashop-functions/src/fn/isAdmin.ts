// import * as admin from "firebase-admin";
// import {CallableContext} from "firebase-functions/lib/providers/https";

// admin.initializeApp();

// export default async (
//     request: any,
//     context: CallableContext
// ) => {
//   return admin.firestore().doc("parameters/admin").get()
//       .then((response) => {
//         const adminUsers = response.data()?.adminusers as string[];
//         return adminUsers.findIndex((user) => user === context.auth?.uid) > -1;
//       });
// };
