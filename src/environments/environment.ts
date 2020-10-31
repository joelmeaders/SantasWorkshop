// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
import { name, version } from '../../package.json';
import { apiKey } from './firebase.environment.json';

export const environment = {
  production: false,
  name,
  version,
};

export const firebaseConfig = {
  apiKey,
  authDomain: 'santas-workshop-193b5.firebaseapp.com',
  databaseURL: 'https://santas-workshop-193b5.firebaseio.com',
  projectId: 'santas-workshop-193b5',
  storageBucket: 'santas-workshop-193b5.appspot.com',
  messagingSenderId: '397997267986',
  appId: '1:397997267986:web:8c85e08550793dd348cccb',
  measurementId: 'G-0KHS1T1W85',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
