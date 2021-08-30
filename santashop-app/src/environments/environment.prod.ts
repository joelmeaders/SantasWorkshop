import config from './config.json';

export const environment = {
  production: true,
  ...config
};

export const firebaseConfig = {
  apiKey: 'undefined',
  authDomain: 'undefined',
  databaseURL: 'undefined',
  projectId: 'undefined',
  storageBucket: 'undefined',
  messagingSenderId: 'undefined',
  appId: 'undefined',
  measurementId: 'undefined'
};
