import { vi } from 'vitest';

const firebaseFunction = vi.fn();

vi.mock('firebase/analytics', () => ({ logEvent: firebaseFunction }));

vi.mock('firebase/auth', () => ({
	EmailAuthProvider: { credential: firebaseFunction },
	onAuthStateChanged: firebaseFunction,
	reauthenticateWithCredential: firebaseFunction,
	sendPasswordResetEmail: firebaseFunction,
	signInWithEmailAndPassword: firebaseFunction,
	updatePassword: firebaseFunction,
}));

vi.mock('firebase/functions', () => ({ httpsCallable: firebaseFunction }));

vi.mock('firebase/storage', () => ({
	getDownloadURL: firebaseFunction,
	ref: firebaseFunction,
}));

class Timestamp {
	public static fromDate = vi.fn().mockReturnValue(new Timestamp());
	public static now = vi.fn().mockReturnValue(new Timestamp());
	public toDate = vi.fn().mockReturnValue(new Date());
}

vi.mock('firebase/firestore', () => ({
	addDoc: firebaseFunction,
	collection: firebaseFunction,
	deleteDoc: firebaseFunction,
	doc: firebaseFunction,
	getDoc: firebaseFunction,
	getDocs: firebaseFunction,
	limit: firebaseFunction,
	onSnapshot: firebaseFunction,
	orderBy: firebaseFunction,
	query: firebaseFunction,
	setDoc: firebaseFunction,
	Timestamp,
	where: firebaseFunction,
}));
