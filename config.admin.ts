import { writeFile } from 'fs';
import { version } from './package.json';

const targetPath = './santashop-admin/src/environments/environment.prod.ts';

const envConfigFile = `export const environment = {
    production: true,
    label: 'PROD',
    name: 'SWAdmin',
    version: '${version}',
    appCheckKey: '6Lc4vgkpAAAAACOIJc4lTNn4wLzvuJkoz17t_RXH'
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

writeFile(targetPath, envConfigFile, 'utf8', function (err) {
	if (err) {
		throw console.error(err);
	} else {
		console.log(
			`Angular environment.ts file generated correctly at ${targetPath} \n`,
		);
	}
});
