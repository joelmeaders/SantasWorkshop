import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { RegistrationReviewPageComponent } from './registration-review-page.component';
import {
	REGISTRATION_REVIEW_READER,
	type RegistrationReviewReader,
	type ReviewCaseDetail,
} from './registration-review-reader';

const entry: ReviewCaseDetail = {
	id: 'DEMO-CASE',
	season: 2026,
	registrations: ['DEMO-R1', 'DEMO-R2'],
	tier: 'strict',
	evidence: {
		firstNameMatches: 2,
		exactDateMatches: 1,
		fullNameMatches: 1,
		dobConflicts: 0,
		missingDobComparisons: 0,
		sameAdultName: false,
		reliableContact: false,
		sameZip: false,
		rosterSizes: [2, 3],
	},
	lastActionAt: '2026-11-17T15:00:00Z',
	history: [],
	status: 'new',
};

describe('RegistrationReviewPageComponent', () => {
	let fixture: ComponentFixture<RegistrationReviewPageComponent>;
	let component: RegistrationReviewPageComponent;
	const list = vi.fn<RegistrationReviewReader['list']>();
	const detail = vi.fn<RegistrationReviewReader['detail']>();
	const appendNote =
		vi.fn<NonNullable<RegistrationReviewReader['appendNote']>>();
	const setStatus =
		vi.fn<NonNullable<RegistrationReviewReader['setStatus']>>();

	const performAction =
		vi.fn<NonNullable<RegistrationReviewReader['performAction']>>();

	async function settle(): Promise<void> {
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	}

	beforeEach(async () => {
		list.mockReset().mockReturnValue(
			of({ cases: [entry], nextCursor: 'cursor-2' }),
		);
		detail.mockReset().mockReturnValue(of(entry));
		appendNote.mockReset();
		setStatus.mockReset();
		TestBed.configureTestingModule({
			imports: [RegistrationReviewPageComponent],
			providers: [
				{
					provide: REGISTRATION_REVIEW_READER,
					useValue: {
						list,
						detail,
						appendNote,
						setStatus,
						performAction,
					},
				},
			],
		});
		fixture = TestBed.createComponent(RegistrationReviewPageComponent);
		component = fixture.componentInstance;
		await settle();
	});

	async function enable(): Promise<void> {
		fixture.componentRef.setInput('claims', { owner: true });
		fixture.componentRef.setInput('enabled', true);
		await settle();
	}

	it('makes no disabled requests and starts fresh pagination when the scoped search changes', async () => {
		expect(list).not.toHaveBeenCalled();
		await enable();
		expect(list).toHaveBeenLastCalledWith({ scope: 'open', limit: 25 });
		component.next();
		await settle();
		expect(component.pageNumber()).toBe(2);
		expect(list).toHaveBeenLastCalledWith({
			scope: 'open',
			limit: 25,
			after: 'cursor-2',
		});
		component.previous();
		await settle();
		expect(component.pageNumber()).toBe(1);
		component.next();
		await settle();
		component.updateSearchMode('email-prefix');
		component.updateSearch('xy');
		component.submitSearch(new Event('submit'));
		expect(component.searchError()).toBe(true);
		expect(component.pageNumber()).toBe(2);
		component.updateSearch('  DEMO@  ');
		component.submitSearch(new Event('submit'));
		await settle();
		expect(component.pageNumber()).toBe(1);
		expect(list).toHaveBeenLastCalledWith({
			scope: 'open',
			limit: 25,
			search: 'demo@',
			searchMode: 'email-prefix',
		});
		component.changeScope('resolved');
		await settle();
		expect(list).toHaveBeenLastCalledWith({
			scope: 'resolved',
			limit: 25,
			search: 'demo@',
			searchMode: 'email-prefix',
		});
		component.clearSearch();
		await settle();
		expect(list).toHaveBeenLastCalledWith({ scope: 'resolved', limit: 25 });
	});

	it('surfaces refinement feedback for bounded searches and retries the current case', async () => {
		list.mockReturnValueOnce(
			throwError(() => ({ code: 'functions/resource-exhausted' })),
		);
		await enable();
		expect(component.listing().state).toBe('refine');
		component.retryList();
		await settle();
		expect(component.listing().state).toBe('ready');
		detail.mockReturnValueOnce(
			throwError(() => new Error('Synthetic case failure')),
		);
		component.open(entry.id);
		await settle();
		expect(component.detail().state).toBe('error');
		component.retryDetail();
		await settle();
		expect(component.detail().state).toBe('ready');
	});

	it('puts registration and child actions inside the matching card and leaves notes at the case level', async () => {
		const record = (id: string, index: number) => ({
			id,
			name: index ? 'Second Parent' : 'First Parent',
			email: 'parent' + index + '@example.test',
			appointment: '',
			expectedRevision: '10:0',
			availableActions: ['cancel', 'removeChild'] as const,
			children: [
				{
					name: index ? 'Second Child' : 'First Child',
					birthDate: '2018-05-01',
					childIndex: 0,
				},
			],
		});
		const records = [record('DEMO-R1', 0), record('DEMO-R2', 1)] as const;
		detail.mockReturnValueOnce(of({ ...entry, records }));
		await enable();
		component.open(entry.id);
		await settle();
		const page = fixture.nativeElement as HTMLElement;
		const [first, second] = page.querySelectorAll<HTMLElement>(
			'.comparison .record',
		);
		expect(
			first
				.querySelector('[aria-label^="Cancel registration"]')
				?.getAttribute('aria-label'),
		).toContain('First Parent (DEMO-R1)');
		expect(
			second.querySelector('.child-actions li')?.textContent,
		).toContain('Second Child');
		expect(
			second
				.querySelector('[aria-label^="Remove child"]')
				?.getAttribute('aria-label'),
		).toContain('Second Parent (DEMO-R2) Second Child');
		expect(second.querySelector('[aria-label*="DEMO-R1"]')).toBeNull();
		expect(page.querySelectorAll('.comparison textarea')).toHaveLength(0);
		expect(
			page.querySelector(
				'[aria-labelledby="case-actions-title"] textarea',
			)?.id,
		).toBe('case-note');
		expect(
			page.querySelector('[aria-labelledby="case-actions-title"] select')
				?.id,
		).toBe('review-case-status');
	});

	it('keeps a stable note ID on a lost receipt and clears detail after resolving from the open queue', async () => {
		await enable();
		component.open(entry.id);
		await settle();
		const response = new Subject<
			NonNullable<ReviewCaseDetail['notes']>[number]
		>();
		appendNote
			.mockReturnValueOnce(
				throwError(
					() => new Error('Synthetic note acknowledgement failure'),
				),
			)
			.mockReturnValueOnce(response);
		component.note.set('  Synthetic retry note  ');
		component.appendNote();
		expect(component.noteError()).toBe(true);
		component.appendNote();
		expect(component.noteSaving()).toBe(true);
		component.appendNote();
		expect(appendNote).toHaveBeenCalledTimes(2);
		expect(appendNote.mock.calls[0][0]).toEqual(
			appendNote.mock.calls[1][0],
		);
		const [{ noteId }] = appendNote.mock.calls[1];
		response.next({
			id: noteId,
			text: 'Synthetic retry note',
			author: 'DEMO-OWNER',
			at: entry.lastActionAt,
		});
		expect(component.note()).toBe('');
		await settle();
		const select = (fixture.nativeElement as HTMLElement).querySelector(
			'select#review-case-status',
		);
		if (!(select instanceof HTMLSelectElement))
			throw new Error('Review status selector missing.');
		setStatus.mockReturnValueOnce(of({ ...entry, status: 'resolved' }));
		select.value = 'resolved';
		select.dispatchEvent(new Event('change'));
		await settle();
		expect(setStatus).toHaveBeenCalledWith({
			id: entry.id,
			status: 'resolved',
		});
		expect(component.selectedId()).toBeUndefined();
		expect(component.feedback()).toBe('Review status updated.');
	});
});
