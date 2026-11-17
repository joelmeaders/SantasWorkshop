import { inject, type Provider } from '@angular/core';
import { FunctionsWrapper } from '@santashop/core/admin';
import { defer, map, type Observable } from 'rxjs';
import {
	REGISTRATION_REVIEW_READER,
	type RegistrationReviewReader,
	type ReviewCaseDetail,
	type ReviewCaseNote,
	type ReviewCaseRegistration,
	type ReviewListRequest,
	type ReviewMutationRequest,
	type ReviewMutationResult,
	type ReviewQueuePage,
	type ReviewQueueStatus,
} from './registration-review-reader';

type WireNote = Omit<ReviewCaseNote, 'author'> & { readonly actorUid: string };
type WireDetail = Omit<ReviewCaseDetail, 'notes' | 'records'> & {
	readonly notes?: readonly WireNote[];
	readonly registrationDetails?: readonly [
		ReviewCaseRegistration | null,
		ReviewCaseRegistration | null,
	];
};

function noteValue(note: WireNote): ReviewCaseNote {
	return { id: note.id, at: note.at, text: note.text, author: note.actorUid };
}

function detailValue(wire: WireDetail): ReviewCaseDetail {
	const { notes, registrationDetails, ...entry } = wire;
	return {
		...entry,
		...(notes ? { notes: notes.map(noteValue) } : {}),
		...(registrationDetails ? { records: registrationDetails } : {}),
	};
}

export function registrationReviewCallableReader(
	wrapper: Pick<FunctionsWrapper, 'callableWrapper'>,
): RegistrationReviewReader {
	function invoke<Input, Output>(
		name: string,
		data: Input,
	): Observable<Output> {
		return defer(() =>
			wrapper.callableWrapper<Input, Output>(name)(data),
		).pipe(map((result) => result.data));
	}
	return {
		list: (request) =>
			invoke<ReviewListRequest, ReviewQueuePage>(
				'listRegistrationReviewCases',
				request,
			),
		detail: (request) =>
			invoke<typeof request, WireDetail>(
				'getRegistrationReviewCase',
				request,
			).pipe(map(detailValue)),
		appendNote: (request) =>
			invoke<typeof request, WireDetail>(
				'addRegistrationReviewNote',
				request,
			).pipe(
				map((result) => {
					const note = result.notes?.find(
						(entry) => entry.id === request.noteId,
					);
					if (!note) throw new Error('Note receipt unavailable.');
					return noteValue(note);
				}),
			),
		setStatus: (request) =>
			invoke<{ id: string; status: ReviewQueueStatus }, WireDetail>(
				'setRegistrationReviewStatus',
				request,
			).pipe(map(detailValue)),
		performAction: (request) =>
			invoke<ReviewMutationRequest, ReviewMutationResult>(
				'performRegistrationReviewAction',
				request,
			),
	};
}

export function provideRegistrationReview(): Provider {
	return {
		provide: REGISTRATION_REVIEW_READER,
		useFactory: () =>
			registrationReviewCallableReader(inject(FunctionsWrapper)),
	};
}
