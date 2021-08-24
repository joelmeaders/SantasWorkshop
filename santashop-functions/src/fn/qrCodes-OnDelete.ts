// import * as functions from "firebase-functions";
// import * as admin from "firebase-admin";

// admin.initializeApp();

// export default async (
//     document: functions.firestore.QueryDocumentSnapshot
// ) => {
//   const storage = admin.storage().bucket("gs://santas-workshop-193b5.appspot.com");
//   const imageToDelete = storage.file(`registrations/${document.data().code}.png`);

//   const exists = await imageToDelete.exists();
//   if (!exists[0]) return;

//   await imageToDelete.delete();
// };
