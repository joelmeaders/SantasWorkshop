import { Injectable, inject } from '@angular/core';
import {
	getDownloadURL,
	ref,
	StorageReference,
} from 'firebase/storage';
import { FIREBASE_STORAGE } from '../tokens';

@Injectable({
	providedIn: 'root',
})
export class StorageWrapper {
	private readonly storage = inject(FIREBASE_STORAGE);

	public readonly ref = (path: string): StorageReference =>
		ref(this.storage, path);

	public readonly getDownloadUrl = (
		pathOrReference: string | StorageReference,
	): Promise<string> =>
		getDownloadURL(
			typeof pathOrReference === 'string'
				? this.ref(pathOrReference)
				: pathOrReference,
		);
}
