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

vi.mock('firebase/analytics', () => ({ logEvent: vi.fn() }));

vi.mock('firebase/auth', () => ({
	EmailAuthProvider: { credential: vi.fn() },
	onAuthStateChanged: vi.fn(),
	reauthenticateWithCredential: vi.fn(),
	sendPasswordResetEmail: vi.fn(),
	signInWithEmailAndPassword: vi.fn(),
	updatePassword: vi.fn(),
}));

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));

vi.mock('firebase/storage', () => ({
	getDownloadURL: vi.fn(),
	ref: vi.fn(),
}));

class Timestamp {
	private readonly date: Date;

	constructor(value: Date | number = new Date(), nanoseconds = 0) {
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
	addDoc: vi.fn(),
	collection: vi.fn(),
	deleteDoc: vi.fn(),
	doc: vi.fn(),
	getDoc: vi.fn(),
	getDocs: vi.fn(),
	limit: vi.fn(),
	onSnapshot: vi.fn(),
	orderBy: vi.fn(),
	query: vi.fn(),
	setDoc: vi.fn(),
	Timestamp,
	where: vi.fn(),
}));
