import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FunctionsWrapper } from '@santashop/core/admin';
import { firstValueFrom } from 'rxjs';
import { provideRegistrationReview } from './registration-review-callables';
import {
	REGISTRATION_REVIEW_READER,
	type ReviewMutationRequest,
} from './registration-review-reader';

describe('registration review callable adapter', () => {
	it('sends authorized request fields only and resolves responses without transport wrappers', async () => {
		const note = {
			id: 'NOTE-FIXTURE',
			actorUid: 'DEMO-OWNER',
			text: 'Synthetic note',
			at: '2026-11-17T01:00:00Z',
		};
		const detail = {
			id: 'DEMO-CASE',
			registrationDetails: [null, null],
			notes: [note],
		};
		const list = { cases: [], nextCursor: 'cursor' };
		const action = {
			action: 'cancel',
			registrationId: 'DEMO-R1',
			notification: 'not-requested',
		};
		const responses: Record<string, unknown> = {
			listRegistrationReviewCases: list,
			getRegistrationReviewCase: detail,
			addRegistrationReviewNote: detail,
			setRegistrationReviewStatus: detail,
			performRegistrationReviewAction: action,
		};
		const invoke = vi.fn(
			async (...[name]: [name: string, input: unknown]) => ({
				data: responses[name],
			}),
		);
		const wrapper = {
			callableWrapper:
				<Input, Output>(name: string) =>
				async (input?: Input): Promise<{ data: Output }> =>
					(await invoke(name, input)) as { data: Output },
		};
		TestBed.configureTestingModule({
			providers: [
				{ provide: FunctionsWrapper, useValue: wrapper },
				provideRegistrationReview(),
			],
		});
		const reader = TestBed.inject(REGISTRATION_REVIEW_READER);
		const listRequest = {
			scope: 'open',
			limit: 25,
			searchMode: 'email-prefix',
			search: 'demo',
			after: 'previous',
		} as const;
		const result$ = reader.list(listRequest);
		expect(invoke).not.toHaveBeenCalled();
		expect(await firstValueFrom(result$)).toEqual(list);
		expect(invoke).toHaveBeenCalledWith(
			'listRegistrationReviewCases',
			listRequest,
		);
		expect(await firstValueFrom(reader.detail({ id: detail.id }))).toEqual({
			id: detail.id,
			records: [null, null],
			notes: [
				{
					id: note.id,
					author: note.actorUid,
					text: note.text,
					at: note.at,
				},
			],
		});
		if (!reader.appendNote || !reader.setStatus || !reader.performAction)
			throw new Error('Expected configured mutation methods.');
		expect(
			await firstValueFrom(
				reader.appendNote({
					id: detail.id,
					noteId: note.id,
					text: note.text,
				}),
			),
		).toMatchObject({ id: note.id, author: note.actorUid });
		expect(invoke).toHaveBeenCalledWith('addRegistrationReviewNote', {
			id: detail.id,
			noteId: note.id,
			text: note.text,
		});
		expect(
			await firstValueFrom(
				reader.setStatus({ id: detail.id, status: 'resolved' }),
			),
		).toMatchObject({ id: detail.id });
		expect(invoke).toHaveBeenCalledWith('setRegistrationReviewStatus', {
			id: detail.id,
			status: 'resolved',
		});
		const mutation: ReviewMutationRequest = {
			action: 'cancel',
			caseId: detail.id,
			registrationId: 'DEMO-R1',
			expectedRevision: '01:0',
			mutationId: 'DEMO-MUTATION',
			reason: 'duplicate-registration',
		};
		expect(await firstValueFrom(reader.performAction(mutation))).toEqual(
			action,
		);
		expect(invoke).toHaveBeenCalledWith(
			'performRegistrationReviewAction',
			mutation,
		);
	});

	it('does not mark a note saved without its own matching receipt', async () => {
		TestBed.configureTestingModule({
			providers: [
				{
					provide: FunctionsWrapper,
					useValue: {
						callableWrapper: () => async () => ({
							data: { id: 'DEMO-CASE' },
						}),
					},
				},
				provideRegistrationReview(),
			],
		});
		const reader = TestBed.inject(REGISTRATION_REVIEW_READER);
		if (!reader.appendNote)
			throw new Error('Expected configured note writer.');
		await expect(
			firstValueFrom(
				reader.appendNote({
					id: 'DEMO-CASE',
					noteId: 'fixture-missing',
					text: 'Synthetic',
				}),
			),
		).rejects.toThrow('Note receipt unavailable.');
	});
});
