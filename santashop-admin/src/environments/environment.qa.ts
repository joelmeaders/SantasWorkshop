import config from '../../../package.json';
import firebaseConfigDev from '../../../firebase.environment.test.json';

export const environment = {
	production: true,
	label: 'TEST/QA',
	name: config.name,
	version: config.version,
};

export const firebaseConfig = { ...firebaseConfigDev };