import config from '../../../package.json';

export const environment = {
	production: true,
	label: 'PROD',
	name: config.name,
	version: config.version,
	appCheckKey: '6Lc4vgkpAAAAACOIJc4lTNn4wLzvuJkoz17t_RXH',
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
