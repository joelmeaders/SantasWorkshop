import { InjectionToken } from '@angular/core';
import type { Analytics } from 'firebase/analytics';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import type { FirebaseStorage } from 'firebase/storage';

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('firebase-app');

export const FIREBASE_AUTH = new InjectionToken<Auth>('firebase-auth');

export const FIREBASE_FIRESTORE = new InjectionToken<Firestore>(
	'firebase-firestore',
);

export const FIREBASE_FUNCTIONS = new InjectionToken<Functions>(
	'firebase-functions',
);

export const FIREBASE_STORAGE = new InjectionToken<FirebaseStorage>(
	'firebase-storage',
);

export const FIREBASE_ANALYTICS = new InjectionToken<Analytics>(
	'firebase-analytics',
);
