import {
	applicationDefault,
	getApps,
	initializeApp,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const args = new Map();
for (let index = 3; index < process.argv.length; index += 2) {
	args.set(process.argv[index], process.argv[index + 1]);
}

const action = process.argv[2];
const projectId = args.get('--project');
const confirmation = args.get('--confirm-project');

if (!['grant', 'revoke', 'transfer'].includes(action ?? '')) {
	throw new Error('Expected action: grant, revoke, or transfer.');
}
if (!projectId || confirmation !== projectId) {
	throw new Error(
		'Provide matching --project and --confirm-project values.',
	);
}

if (getApps().length === 0) {
	initializeApp({ credential: applicationDefault(), projectId });
}

const auth = getAuth();
const firestore = getFirestore();

const listOwners = async () => {
	const owners = [];
	let pageToken;
	do {
		const page = await auth.listUsers(1000, pageToken);
		owners.push(
			...page.users.filter(
				(user) => user.customClaims?.['owner'] === true,
			),
		);
		pageToken = page.pageToken;
	} while (pageToken);
	return owners;
};

const grantOwner = async (uid) => {
	if (!uid) throw new Error('Grant requires --uid.');
	const user = await auth.getUser(uid);
	const currentClaims = user.customClaims ?? {};
	const roles = new Set(
		Array.isArray(currentClaims['roles']) ? currentClaims['roles'] : [],
	);
	roles.add('admin');
	roles.add('checkin');
	await auth.setCustomUserClaims(uid, {
		...currentClaims,
		owner: true,
		admin: true,
		roles: Array.from(roles),
	});
	const now = new Date();
	await firestore.collection('staff').doc(uid).set(
		{
			uid,
			displayName: user.displayName ?? user.email ?? `Owner ${uid}`,
			emailAddress: user.email?.toLowerCase() ?? `${uid}@owner.local`,
			roles: ['admin', 'checkin'],
			disabled: false,
			createdOn: now,
			updatedOn: now,
		},
		{ merge: true },
	);
	console.log(`Granted owner capability to ${uid} in ${projectId}.`);
};

const revokeOwner = async (uid) => {
	if (!uid) throw new Error('Revoke requires --uid.');
	const owners = await listOwners();
	if (
		owners.some((owner) => owner.uid === uid) &&
		owners.filter((owner) => owner.uid !== uid).length === 0
	) {
		throw new Error(
			'Refusing to revoke the last owner. Grant or transfer ownership first.',
		);
	}
	const user = await auth.getUser(uid);
	const claims = { ...(user.customClaims ?? {}) };
	delete claims['owner'];
	await auth.setCustomUserClaims(uid, claims);
	console.log(`Revoked owner capability from ${uid} in ${projectId}.`);
};

if (action === 'grant') {
	await grantOwner(args.get('--uid'));
} else if (action === 'revoke') {
	await revokeOwner(args.get('--uid'));
} else {
	const fromUid = args.get('--from');
	const toUid = args.get('--to');
	if (!fromUid || !toUid || fromUid === toUid) {
		throw new Error('Transfer requires distinct --from and --to UIDs.');
	}
	await grantOwner(toUid);
	await revokeOwner(fromUid);
	console.log(`Transferred ownership from ${fromUid} to ${toUid}.`);
}
