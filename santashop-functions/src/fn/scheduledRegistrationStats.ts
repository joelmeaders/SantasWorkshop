// import * as admin from "firebase-admin";
// import {
//   CompletedRegistration,
//   getAllRegistrationData,
//   isRegistrationComplete,
// } from "../utility/registrations";

// admin.initializeApp();

// let completedRegistrations = 0;
// let dateTimeCount: IDateTimeCount[] = [];
// let zipCodeCount: IZipCodeCount[] = [];

// export default async () => {
//   await admin
//       .firestore()
//       .collection("registrations")
//       .get()
//       .then((snapshot) =>
//         snapshot.forEach((doc) => {
//           const docData = getAllRegistrationData(doc.data());

//           if (isRegistrationComplete(docData)) {
//             completedRegistrations += 1;
//             updateDateTimeCount(docData);
//             updateZipCodeCount(docData);
//           }
//         })
//       );

//   const stats: any = {
//     completedRegistrations: completedRegistrations,
//     dateTimeCount: dateTimeCount,
//     zipCodeCount: zipCodeCount,
//   };

//   await admin
//       .firestore()
//       .collection("stats")
//       .doc("registration-2020")
//       .set(stats, {merge: false});

//   completedRegistrations = 0;
//   dateTimeCount = [];
//   zipCodeCount = [];

//   return null;
// };

// function updateDateTimeCount(registration: CompletedRegistration): void {
//   const index = dateTimeCount.findIndex(
//       (e) => e.date === registration.date && e.time === registration.time
//   );

//   if (index > -1) {
//     dateTimeCount[index].count += 1;
//     dateTimeCount[index].childCount += registration.children.length;
//     return;
//   }

//   const newItem: IDateTimeCount = {
//     date: registration.date,
//     time: registration.time,
//     count: 1,
//     childCount: registration.children.length,
//   };

//   dateTimeCount.push(newItem);
// }

// function updateZipCodeCount(registration: CompletedRegistration): void {
//   const index = zipCodeCount.findIndex((e) => e.zip === registration.zipCode);

//   if (index > -1) {
//     zipCodeCount[index].count += 1;
//     zipCodeCount[index].childCount += registration.children.length;
//     return;
//   }

//   const newItem: IZipCodeCount = {
//     zip: registration.zipCode,
//     count: 1,
//     childCount: registration.children.length,
//   };

//   zipCodeCount.push(newItem);
// }

// interface IDateTimeCount {
//   date: string;
//   time: string;
//   count: number;
//   childCount: number;
// }

// interface IZipCodeCount {
//   zip: string;
//   count: number;
//   childCount: number;
// }
