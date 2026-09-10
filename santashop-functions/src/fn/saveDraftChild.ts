import { type CallableRequest } from 'firebase-functions/v2/https';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import {
	canonicalizeChild,
	requireMutationId,
	requireObject,
	requireOnlyKeys,
} from './registrationMutationSupport';
import { mutateDraftChildren } from './mutateDraftChildren';

interface SaveDraftChildData {
	mutationId: string;
	child: unknown;
}

export default async function saveDraftChild(
	request: CallableRequest<SaveDraftChildData>,
): Promise<true> {
	const uid = requireAuthenticatedUid(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['mutationId', 'child']);
	const mutationId = requireMutationId(data['mutationId']);
	const child = canonicalizeChild(data['child']);
	return mutateDraftChildren(
		uid,
		mutationId,
		'saveDraftChild',
		(children) => {
			const existingIndex = children.findIndex(
				(candidate) => candidate.id === child.id,
			);
			if (existingIndex >= 0) children[existingIndex] = child;
			else children.push(child);
			return children;
		},
	);
}
