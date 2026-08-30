import { vi } from 'vitest';
import { addIcons } from 'ionicons';
import { menuOutline } from 'ionicons/icons';

addIcons({ menuOutline });

Object.defineProperty(navigator, 'mediaDevices', {
	configurable: true,
	value: {
		enumerateDevices: vi.fn().mockResolvedValue([]),
		getUserMedia: vi.fn().mockResolvedValue(new MediaStream()),
	},
});

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
	private readonly date: Date;

	public constructor(value: Date | number = new Date(), nanoseconds = 0) {
		this.date =
			value instanceof Date
				? new Date(value)
				: new Date(value * 1000 + nanoseconds / 1_000_000);
	}

	public static readonly fromDate = vi.fn(
		(date: Date): Timestamp => new Timestamp(date),
	);
	public static readonly now = vi.fn((): Timestamp => new Timestamp());
	public readonly toDate = vi.fn((): Date => new Date(this.date));
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
