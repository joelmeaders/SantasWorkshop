import config from './config.json';

export const environment = {
  production: true,
  label: 'TEST/QA',
  ...config
};

export const firebaseConfig = {
  apiKey: "AIzaSyCsXcZayiATAIDRBIi-uzjPfufmQUiwswU",
  authDomain: "santas-workshop-test.firebaseapp.com",
  databaseURL: "https://santas-workshop-test-default-rtdb.firebaseio.com",
  projectId: "santas-workshop-test",
  storageBucket: "santas-workshop-test.appspot.com",
  messagingSenderId: "312672416598",
  appId: "1:312672416598:web:75721875d43341bef29cf7",
  measurementId: "G-4FQR667VT9"
};