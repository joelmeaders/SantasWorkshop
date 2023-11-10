import config from '../../../package.json';
import firebaseConfigDev from '../../../firebase.environment.test.json';

export const environment = {
	production: true,
	label: 'TEST/QA',
	name: config.name,
	version: config.version,
	appCheckKey: '6LfQqwkpAAAAAHyIhwZ4v9ZGl6lMdwzsh_maGnSU'
};

export const firebaseConfig = { ...firebaseConfigDev };
