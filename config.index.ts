import { writeFile } from 'fs';
import { name, version } from './package.json';

const targetPath = './src/environments/environment.prod.ts';

const envConfigFile = `

  export const environment = {
    production: true,
    name: '${name}',
    version: '${version}'
  };

  export const firebaseConfig = {
    apiKey: '${process.env.FIREBASE_API_KEY}',
    authDomain: 'santas-workshop-193b5.firebaseapp.com',
    databaseURL: 'https://santas-workshop-193b5.firebaseio.com',
    projectId: 'santas-workshop-193b5',
    storageBucket: 'santas-workshop-193b5.appspot.com',
    messagingSenderId: '397997267986',
    appId: '1:397997267986:web:8c85e08550793dd348cccb',
    measurementId: 'G-0KHS1T1W85',
  };
`;

console.log('The file `environment.ts` will be written with the following content: \n');
console.log(envConfigFile);
writeFile(targetPath, envConfigFile, function (err) {
   if (err) {
       throw console.error(err);
   } else {
       console.log(`Angular environment.ts file generated correctly at ${targetPath} \n`);
   }
});
