import config from '../../../package.json';

export const environment = {
  production: true,
  label: 'TEST/QA',
  name: config.name,
  version: config.version,
};

export const firebaseConfig = {
  apiKey: 'undefined',
  authDomain: 'undefined',
  databaseURL: 'undefined',
  projectId: 'undefined',
  storageBucket: 'undefined',
  messagingSenderId: 'undefined',
  appId: 'undefined',
  measurementId: 'undefined',
};
