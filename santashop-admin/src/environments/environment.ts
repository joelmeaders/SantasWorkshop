import config from '../../../package.json';
import firebaseConfigDev from '../../../firebase.environment.json';

export const environment = {
  production: false,
  label: 'DEV',
  name: config.name,
  version: config.version
};

export const firebaseConfig = { ...firebaseConfigDev };

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
