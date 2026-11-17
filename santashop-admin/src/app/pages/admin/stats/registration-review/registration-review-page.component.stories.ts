import {
	applicationConfig,
	type Meta,
	type StoryObj,
} from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { delay, of, throwError, timer, map } from 'rxjs';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { RegistrationReviewPageComponent } from './registration-review-page.component';
import {
	REGISTRATION_REVIEW_READER,
	type RegistrationReviewReader,
	type ReviewCaseDetail,
	type ReviewQueueSummary,
} from './registration-review-reader';

const evidence = {
	firstNameMatches: 2,
	exactDateMatches: 2,
	fullNameMatches: 1,
	dobConflicts: 0,
	missingDobComparisons: 0,
	sameAdultName: false,
	reliableContact: false,
	sameZip: true,
	rosterSizes: [2, 3] as const,
};
const caseA: ReviewQueueSummary = {
	id: 'TEST-RV-01',
	season: 2026,
	registrations: ['TEST-REG-A', 'TEST-REG-B'],
	tier: 'strict',
	status: 'new',
	evidence,
	lastActionAt: '2026-11-16T10:09:00Z',
};
const caseB: ReviewQueueSummary = {
	...caseA,
	id: 'TEST-RV-02',
	registrations: ['TEST-REG-C', 'TEST-REG-D'],
	status: 'hold',
};

function detail(entry: ReviewQueueSummary): ReviewCaseDetail {
	return { ...entry, history: [{ type: 'flagged', at: entry.lastActionAt }] };
}

function readerDecorator(
	create: () => RegistrationReviewReader,
): ReturnType<typeof applicationConfig> {
	return applicationConfig({
		providers: [
			{ provide: REGISTRATION_REVIEW_READER, useFactory: create },
		],
	});
}

const meta = {
	title: 'Admin/Reports/Registration Review Reader',
	component: RegistrationReviewPageComponent,
	decorators: adminStoryDecorators(),
	parameters: { layout: 'fullscreen' },
	args: { enabled: true, claims: { owner: true } },
} satisfies Meta<typeof RegistrationReviewPageComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

let forbiddenReadCount = 0;
function forbiddenRead(): never {
	forbiddenReadCount += 1;
	throw new Error(
		'Reader must not run without permission and configuration.',
	);
}

export const DisabledByDefault: Story = {
	args: { enabled: false },
	decorators: [
		readerDecorator(() => ({
			list: forbiddenRead,
			detail: forbiddenRead,
		})),
	],
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText('Registration review is unavailable.'),
		).toBeVisible();
		await expect(
			canvas.queryByRole('heading', { name: 'Case queue' }),
		).not.toBeInTheDocument();
		await expect(forbiddenReadCount).toBe(0);
	},
};

export const OrdinaryAdminDenied: Story = {
	args: { claims: { roles: ['admin'] } },
	decorators: [
		readerDecorator(() => ({
			list: forbiddenRead,
			detail: forbiddenRead,
		})),
	],
	play: async ({ canvasElement }): Promise<void> => {
		await expect(
			within(canvasElement).getByText(
				'Registration review is unavailable.',
			),
		).toBeVisible();
		await expect(forbiddenReadCount).toBe(0);
	},
};

export const MissingTransport: Story = {
	play: async ({ canvasElement }): Promise<void> => {
		await expect(
			within(canvasElement).getByText(
				'Registration review is unavailable.',
			),
		).toBeVisible();
	},
};

export const QueueJourney: Story = {
	args: { claims: { roles: ['admin', 'registration-review'] } },
	decorators: [
		readerDecorator(() => ({
			list: ({ scope, after }) =>
				of(
					scope === 'resolved'
						? { cases: [], nextCursor: null }
						: after
							? {
									cases: [{ ...caseB, id: 'TEST-RV-03' }],
									nextCursor: null,
								}
							: { cases: [caseA, caseB], nextCursor: 'page-2' },
				).pipe(delay(150)),
			detail: ({ id }) =>
				id === caseA.id
					? timer(600).pipe(map(() => detail(caseA)))
					: of(detail(caseB)),
		})),
	],
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Loading review cases…')).toBeVisible();
		await userEvent.click(
			await canvas.findByRole('button', { name: /TEST-RV-01/ }),
		);
		await expect(canvas.getByText('Loading case details…')).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: /TEST-RV-02/ }),
		);
		await expect(
			await canvas.findByText('TEST-REG-C / TEST-REG-D'),
		).toBeVisible();
		await expect(canvas.getByText('Flagged for review')).toBeVisible();
		await expect(
			canvas.queryByText('TEST-REG-A / TEST-REG-B'),
		).not.toBeInTheDocument();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Next page' }),
		);
		await expect(
			await canvas.findByRole('button', { name: /TEST-RV-03/ }),
		).toBeVisible();
		await expect(
			canvas.queryByText('TEST-REG-C / TEST-REG-D'),
		).not.toBeInTheDocument();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Previous page' }),
		);
		await expect(
			await canvas.findByRole('button', { name: /TEST-RV-01/ }),
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Resolved', exact: true }),
		);
		await expect(
			await canvas.findByText('No cases in this view.'),
		).toBeVisible();
	},
};

export const RetryJourney: Story = {
	decorators: [
		readerDecorator(() => {
			let listAttempt = 0;
			let detailAttempt = 0;
			return {
				list: () =>
					++listAttempt === 1
						? throwError(() => new Error('List fixture failure'))
						: of({ cases: [caseA], nextCursor: null }),
				detail: () =>
					++detailAttempt === 1
						? throwError(() => new Error('Detail fixture failure'))
						: of(detail(caseA)),
			};
		}),
	],
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('alert')).toHaveTextContent(
			'Review cases could not be loaded.',
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Retry queue' }),
		);
		await userEvent.click(
			await canvas.findByRole('button', { name: /TEST-RV-01/ }),
		);
		await expect(await canvas.findByRole('alert')).toHaveTextContent(
			'Case details could not be loaded.',
		);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Retry case' }),
		);
		await expect(
			await canvas.findByText('TEST-REG-A / TEST-REG-B'),
		).toBeVisible();
	},
};

// Test-only writer; this story does not register a provider in the admin app.
export const NoteJourney: Story = {
	decorators: [
		readerDecorator(() => {
			const notes: NonNullable<ReviewCaseDetail['notes']>[number][] = [];
			return {
				list: () => of({ cases: [caseA], nextCursor: null }),
				detail: () => of({ ...detail(caseA), notes: [...notes] }),
				appendNote: ({
					text,
				}): ReturnType<
					NonNullable<RegistrationReviewReader['appendNote']>
				> => {
					const entry = {
						id: 'TEST-NOTE-1',
						author: 'Preview Reviewer',
						at: '2026-11-17T16:00:00Z',
						text,
					};
					notes.push(entry);
					return of(entry);
				},
			};
		}),
	],
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: /TEST-RV-01/ }),
		);
		const notes = within(
			await canvas.findByRole('region', { name: 'Internal notes' }),
		);
		await expect(
			notes.getByRole('button', { name: 'Add note' }),
		).toBeDisabled();
		await userEvent.type(
			notes.getByRole('textbox', { name: 'Add an internal note' }),
			'Waiting for a second review.',
		);
		await userEvent.click(notes.getByRole('button', { name: 'Add note' }));
		await expect(
			await canvas.findByText('Waiting for a second review.'),
		).toBeVisible();
		await expect(canvas.getByText('Preview Reviewer')).toBeVisible();
		await expect(
			canvas.getByRole('textbox', { name: 'Add an internal note' }),
		).toHaveValue('');
		await expect(
			canvas.queryByRole('button', { name: /send|edit|delete/i }),
		).not.toBeInTheDocument();
	},
};

const fixtureAddress = (registrationId: string): string =>
	registrationId.toLowerCase() + '+adult@review.test';

export const SearchAcrossManyCases: Story = {
	decorators: [
		readerDecorator(() => {
			const allCases: readonly ReviewQueueSummary[] = Array.from(
				{ length: 215 },
				(_, index) => ({
					...caseA,
					id: 'PAGED-RV-' + String(index + 1).padStart(3, '0'),
					registrations: [
						index === 192
							? 'PAGED-LEFT-193'
							: index % 2 === 0
								? 'SHARED-REG-ID'
								: 'OTHER-REG-ID',
						'PAGED-REG-' + String(index + 1).padStart(3, '0'),
					],
					status: index === 196 ? 'resolved' : 'new',
				}),
			);
			return {
				list: ({
					scope,
					after,
					limit,
					search,
				}): ReturnType<RegistrationReviewReader['list']> => {
					const query = search?.trim();
					const matching = allCases.filter(
						(entry) =>
							(scope === 'all' ||
								(entry.status === 'resolved') ===
									(scope === 'resolved')) &&
							(!query ||
								entry.id === query ||
								entry.registrations.includes(query) ||
								entry.registrations.some(
									(registrationId) =>
										fixtureAddress(registrationId) ===
										query.toLowerCase(),
								)),
					);
					const offset = after ? Number(after) : 0;
					return of({
						cases: matching.slice(offset, offset + limit),
						nextCursor:
							offset + limit < matching.length
								? String(offset + limit)
								: null,
					}).pipe(delay(80));
				},
				detail: ({
					id,
				}): ReturnType<RegistrationReviewReader['detail']> => {
					const entry = allCases.find(
						(candidate) => candidate.id === id,
					);
					if (!entry)
						return throwError(
							() => new Error('Unknown fixture case'),
						);
					const registration = (
						recordId: string,
						name: string,
						count: number,
					): NonNullable<ReviewCaseDetail['records']>[number] => ({
						id: recordId,
						name,
						email: fixtureAddress(recordId),
						appointment: 'Dec 8, 10:00 AM',
						children: Array.from({ length: count }, (_, index) => ({
							name: 'Sample child ' + (index + 1),
							birthDate: '2017-12-15',
						})),
					});
					return of({
						...detail(entry),
						records: [
							registration(
								entry.registrations[0],
								'Sample parent A',
								2,
							),
							registration(
								entry.registrations[1],
								'Sample parent B',
								3,
							),
						],
					});
				},
			};
		}),
	],
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const byCase = (number: string): Promise<HTMLElement> =>
			canvas.findByRole('button', {
				name: new RegExp('PAGED-RV-' + number),
			});
		const next = (): HTMLElement =>
			canvas.getByRole('button', { name: 'Next page' });
		const previous = (): HTMLElement =>
			canvas.getByRole('button', { name: 'Previous page' });
		const search = canvas.getByRole('searchbox', {
			name: 'Search by case ID, registration ID, or email',
		});
		const submit = async (query: string): Promise<void> => {
			await userEvent.clear(search);
			await userEvent.type(search, query + '{enter}');
		};

		await expect(await byCase('001')).toBeVisible();
		await expect(
			canvas.queryByRole('button', { name: /PAGED-RV-190/ }),
		).not.toBeInTheDocument();
		await userEvent.click(next());
		await expect(await byCase('026')).toBeVisible();
		await expect(canvas.getByText('Page 2')).toBeVisible();
		await userEvent.click(previous());
		await expect(await byCase('001')).toBeVisible();

		// A registration beyond the first page cannot be found by filtering visible rows.
		await submit('PAGED-REG-190');
		await expect(await byCase('190')).toBeVisible();
		await expect(
			canvas.queryByRole('button', { name: /PAGED-RV-001/ }),
		).not.toBeInTheDocument();
		await userEvent.click(await byCase('190'));
		await expect(
			await canvas.findByRole('heading', { name: 'PAGED-RV-190' }),
		).toBeVisible();

		const firstRegistration = within(
			canvas.getByRole('article', { name: 'OTHER-REG-ID' }),
		);
		const secondRegistration = within(
			canvas.getByRole('article', { name: 'PAGED-REG-190' }),
		);
		await expect(
			firstRegistration.getByText(/^2 children$/i),
		).toBeVisible();
		await expect(
			secondRegistration.getByText(/^3 children$/i),
		).toBeVisible();

		// Search can itself span pages. A fresh query clears the prior case and cursor.
		await submit('SHARED-REG-ID');
		await expect(await byCase('001')).toBeVisible();
		await expect(
			canvas.queryByRole('heading', { name: 'PAGED-RV-190' }),
		).not.toBeInTheDocument();
		await userEvent.click(next());
		await expect(await byCase('051')).toBeVisible();
		await expect(canvas.getByText('Page 2')).toBeVisible();
		await userEvent.click(previous());
		await expect(await byCase('001')).toBeVisible();

		await submit('PAGED RV 190');
		await expect(canvas.getByRole('alert')).toBeVisible();
		await expect(await byCase('001')).toBeVisible();

		// A prefix is not an exact match.
		await submit('PAGED-RV-19');
		await expect(
			await canvas.findByText('No cases match that search in this view.'),
		).toBeVisible();

		// Search the full adult email of either registration, not just IDs on the loaded page.
		await submit('  PAGED-REG-190+ADULT@REVIEW.TEST  ');
		const rightEmailMatch = await byCase('190');
		await expect(rightEmailMatch).toBeVisible();
		await expect(rightEmailMatch).not.toHaveTextContent('@review.test');
		await expect(canvas.getByText('Email filter applied')).toBeVisible();
		await expect(
			canvas.queryByText(/paged-reg-190\+adult@review\.test/i),
		).not.toBeInTheDocument();
		await expect(
			decodeURIComponent(location.href).toLowerCase(),
		).not.toContain('@review.test');

		await submit('PAGED-LEFT-193+adult@review.test');
		await expect(await byCase('193')).toBeVisible();

		await submit('page+adult@review.test');
		await expect(
			await canvas.findByText('No cases match that search in this view.'),
		).toBeVisible();

		// An exact match on a closed case remains excluded by the Open filter.
		await submit('PAGED-REG-197+adult@review.test');
		await expect(
			await canvas.findByText('No cases match that search in this view.'),
		).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Resolved', exact: true }),
		);
		await expect(await byCase('197')).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Clear search' }),
		);
		await expect(search).toHaveValue('');
		await expect(await byCase('197')).toBeVisible();
		await userEvent.click(
			canvas.getByRole('button', { name: 'Open', exact: true }),
		);
		await expect(await byCase('001')).toBeVisible();
	},
};

export const ReviewActionJourney: Story = {
	decorators: [
		readerDecorator(() => {
			const email = 'sample-parent-a@review.test';
			let canceled = false;
			let revision = 1;
			return {
				list: () => of({ cases: [caseA], nextCursor: null }),
				detail: () =>
					of({
						...detail(caseA),
						records: [
							{
								id: 'TEST-REG-A',
								name: 'Sample Parent A',
								email,
								appointment: 'Dec 8, 10:00 AM',
								expectedRevision: '1:' + revision,
								availableActions: canceled
									? ['reinstate', 'contact']
									: ['cancel', 'contact'],
								children: [],
							},
							{
								id: 'TEST-REG-B',
								name: 'Sample Parent B',
								email: 'sample-parent-b@review.test',
								appointment: 'Dec 8, 10:00 AM',
								expectedRevision: '1:1',
								availableActions: ['contact'],
								children: [],
							},
						],
					}),
				performAction: (
					request,
				): ReturnType<
					NonNullable<RegistrationReviewReader['performAction']>
				> => {
					if (
						request.caseId !== caseA.id ||
						request.registrationId !== 'TEST-REG-A' ||
						request.expectedRevision !== '1:' + revision
					) {
						return throwError(
							() =>
								new Error(
									'Wrong case, registration, or stale fixture version',
								),
						);
					}
					if (request.action === 'cancel' && !request.notification) {
						canceled = true;
					} else if (
						request.action === 'reinstate' &&
						request.notification?.recipient === email &&
						request.notification.customMessage ===
							'Review message only'
					) {
						canceled = false;
					} else {
						return throwError(
							() => new Error('Unexpected email choice'),
						);
					}
					revision += 1;
					return of({
						action: request.action,
						registrationId: request.registrationId,
						notification: request.notification
							? 'queued'
							: 'not-requested',
					}).pipe(delay(100));
				},
			};
		}),
	],
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await userEvent.click(
			await canvas.findByRole('button', { name: /TEST-RV-01/ }),
		);
		const beginCancel = (): Promise<HTMLElement> =>
			canvas.findByRole('button', {
				name: /Cancel registration.*Sample Parent A/,
			});
		await userEvent.click(await beginCancel());
		let dialog = within(canvas.getByRole('dialog'));
		await expect(
			dialog.getByRole('button', { name: 'Confirm without email' }),
		).toBeDisabled();
		await userEvent.click(
			dialog.getByRole('button', { name: 'Keep unchanged' }),
		);
		await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();

		await userEvent.click(await beginCancel());
		dialog = within(canvas.getByRole('dialog'));
		await expect(
			dialog.getByRole('checkbox', { name: 'Also send a shopper email' }),
		).not.toBeChecked();
		await userEvent.type(
			dialog.getByRole('textbox', { name: 'Reason (internal only)' }),
			'Confirmed issue',
		);
		await userEvent.click(
			dialog.getByRole('button', { name: 'Confirm without email' }),
		);
		await expect(
			await canvas.findByText(
				'Action recorded. No shopper email was requested.',
			),
		).toBeVisible();

		await userEvent.click(
			await canvas.findByRole('button', {
				name: /Reinstate registration.*Sample Parent A/,
			}),
		);
		dialog = within(canvas.getByRole('dialog'));
		await userEvent.type(
			dialog.getByRole('textbox', { name: 'Reason (internal only)' }),
			'Reviewed with shopper',
		);
		await userEvent.click(
			dialog.getByRole('checkbox', { name: 'Also send a shopper email' }),
		);
		await expect(
			dialog.getByText('sample-parent-a@review.test'),
		).toBeVisible();
		await expect(
			dialog.queryByText('sample-parent-b@review.test'),
		).not.toBeInTheDocument();
		await userEvent.type(
			dialog.getByRole('textbox', { name: 'Custom message (optional)' }),
			'Review message only',
		);
		await userEvent.click(
			dialog.getByRole('button', { name: 'Confirm and queue email' }),
		);
		await expect(await beginCancel()).toBeVisible();
		await expect(canvas.queryByRole('dialog')).not.toBeInTheDocument();
		await expect(
			canvas.queryByRole('button', {
				name: /Block email for future seasons/,
			}),
		).not.toBeInTheDocument();
	},
};
