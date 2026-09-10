import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { requireAuthenticatedUid } from '../utility/callable-validation';
import {
	requireMutationId,
	requireObject,
	requireOnlyKeys,
} from './registrationMutationSupport';
import { mutateDraftChildren } from './mutateDraftChildren';

interface DeleteDraftChildData {
	mutationId: string;
	childId: number;
}

const requireChildId = (value: unknown): number => {
	if (!Number.isSafeInteger(value) || (value as number) < 0) {
		throw new HttpsError(
			'invalid-argument',
			'Child ID must be a non-negative integer.',
		);
	}
	return value as number;
};

export default async function deleteDraftChild(
	request: CallableRequest<DeleteDraftChildData>,
): Promise<true> {
	const uid = requireAuthenticatedUid(request);
	const data = requireObject(request.data);
	requireOnlyKeys(data, ['mutationId', 'childId']);
	const mutationId = requireMutationId(data['mutationId']);
	const childId = requireChildId(data['childId']);
	return mutateDraftChildren(
		uid,
		mutationId,
		'deleteDraftChild',
		(children) => {
			if (!children.some((child) => child.id === childId)) {
				throw new HttpsError(
					'not-found',
					'Child was not found in this registration.',
				);
			}
			return children.filter((child) => child.id !== childId);
		},
	);
}
