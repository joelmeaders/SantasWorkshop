import {
	ChangeDetectionStrategy,
	DestroyRef,
	Component,
	ElementRef,
	computed,
	inject,
	input,
	signal,
	viewChild,
} from '@angular/core';
import {
	takeUntilDestroyed,
	toObservable,
	toSignal,
} from '@angular/core/rxjs-interop';
import {
	catchError,
	defer,
	finalize,
	map,
	of,
	startWith,
	switchMap,
	take,
	type Observable,
} from 'rxjs';
import {
	RegistrationReviewToolsComponent,
	reviewActionLabels,
} from './registration-review-tools.component';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import {
	REGISTRATION_REVIEW_READER,
	canReadRegistrationReview,
	normalizeReviewNote,
	normalizeReviewSearch,
	reviewNoteMaxLength,
	reviewSearchMaxLength,
	type ReviewCaseDetail,
	type ReviewCaseChild,
	type ReviewClaims,
	type ReviewQueuePage,
	type ReviewQueueScope,
	type ReviewQueueStatus,
	type ReviewSearchMode,
} from './registration-review-reader';

type ReadState<T> =
	| {
			readonly state:
				'unavailable' | 'idle' | 'loading' | 'error' | 'refine';
	  }
	| { readonly state: 'ready'; readonly value: T };

function load<T>(start: () => Observable<T>): Observable<ReadState<T>> {
	return defer(start).pipe(
		map((value): ReadState<T> => ({ state: 'ready', value })),
		startWith({ state: 'loading' } as const),
		catchError((failure: unknown) =>
			of({
				state:
					failure &&
					typeof failure === 'object' &&
					'code' in failure &&
					failure.code === 'functions/resource-exhausted'
						? 'refine'
						: 'error',
			} as const),
		),
	);
}

const labels: Record<ReviewQueueStatus, string> = {
	new: 'New',
	'pending-shopper-response': 'Waiting for shopper',
	hold: 'On hold',
	resolved: 'Resolved',
};

@Component({
	selector: 'admin-registration-review-page',
	templateUrl: './registration-review-page.component.html',
	styleUrl: './registration-review-page.component.scss',
	imports: [AdminTextPipe, RegistrationReviewToolsComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationReviewPageComponent {
	private readonly reader = inject(REGISTRATION_REVIEW_READER, {
		optional: true,
	});
	public readonly enabled = input(false);
	public readonly claims = input<ReviewClaims>();
	public readonly allowed = computed(
		() => this.enabled() && canReadRegistrationReview(this.claims()),
	);
	public readonly available = computed(
		() => this.allowed() && this.reader !== null,
	);

	public readonly labels = labels;
	public readonly actionLabels = reviewActionLabels;
	public readonly statusOptions = Object.keys(labels) as ReviewQueueStatus[];
	public readonly statusHelp: Record<ReviewQueueStatus, string> = {
		new: 'Put this case back in the queue for an initial review.',
		'pending-shopper-response':
			'Use after reaching out when you still need a reply.',
		hold: 'Leave this case open while you get more information.',
		resolved:
			'Use when no further review is needed. Find the case under Resolved afterward.',
	};
	public readonly statusDraft = signal<ReviewQueueStatus | null>(null);
	public readonly scopes = [
		{ id: 'open', label: 'Open' },
		{ id: 'resolved', label: 'Resolved' },
		{ id: 'all', label: 'All' },
	] as const;
	public readonly scope = signal<ReviewQueueScope>('open');
	private readonly queueTitle =
		viewChild<ElementRef<HTMLElement>>('queueTitle');
	public readonly finishNoteFirst = computed(() => {
		const status = this.statusDraft();
		return !!status && this.leavesScope(status) && !!this.note().trim();
	});
	public readonly searchDraft = signal('');
	public readonly searchError = signal(false);
	public readonly search = signal('');
	public readonly searchModeDraft = signal<ReviewSearchMode>('exact');
	public readonly searchMode = signal<ReviewSearchMode>('exact');
	public readonly searchMaxLength = reviewSearchMaxLength;
	private readonly cursorTrail = signal<readonly string[]>([]);
	public readonly pageNumber = computed(() => this.cursorTrail().length + 1);
	private readonly listAttempt = signal(0);
	private readonly detailAttempt = signal(0);
	public readonly selectedId = signal<string | undefined>(undefined);
	private readonly destroyRef = inject(DestroyRef);
	public readonly notesWritable = computed(
		() => this.available() && !!this.reader?.appendNote,
	);
	public readonly noteMaxLength = reviewNoteMaxLength;
	public readonly note = signal('');
	private noteIntent: { id: string; text: string; noteId: string } | null =
		null;
	public readonly statusWritable = computed(
		() => this.available() && !!this.reader?.setStatus,
	);
	public readonly statusSaving = signal(false);
	public readonly statusError = signal(false);
	public readonly feedback = signal('');
	public readonly noteSaving = signal(false);
	public readonly noteError = signal(false);
	public readonly noteValid = computed(
		() => normalizeReviewNote(this.note()) !== null,
	);

	private readonly listQuery = computed(() => {
		this.listAttempt();
		return {
			available: this.available(),
			scope: this.scope(),
			search: this.search(),
			searchMode: this.searchMode(),
			after: this.cursorTrail().at(-1),
		};
	});
	private readonly detailQuery = computed(() => {
		this.detailAttempt();
		return { available: this.available(), id: this.selectedId() };
	});

	public readonly listing = toSignal(
		toObservable(this.listQuery).pipe(
			switchMap(({ available, scope, search, searchMode, after }) => {
				const reader = this.reader;
				return available && reader
					? load(() =>
							reader.list({
								scope,
								limit: 25,
								...(search
									? {
											search,
											...(searchMode === 'email-prefix'
												? { searchMode }
												: {}),
										}
									: {}),
								...(after ? { after } : {}),
							}),
						)
					: of({ state: 'unavailable' } as const);
			}),
		),
		{
			initialValue: {
				state: 'unavailable',
			} as ReadState<ReviewQueuePage>,
		},
	);

	public readonly detail = toSignal(
		toObservable(this.detailQuery).pipe(
			switchMap(({ available, id }) => {
				const reader = this.reader;
				return available && id && reader
					? load(() => reader.detail({ id }))
					: of({ state: 'idle' } as const);
			}),
		),
		{ initialValue: { state: 'idle' } as ReadState<ReviewCaseDetail> },
	);

	public changeScope(scope: ReviewQueueScope): void {
		if (scope === this.scope()) return;
		this.resetQueue();
		this.scope.set(scope);
	}

	public updateSearch(value: string): void {
		this.searchDraft.set(value);
		this.searchError.set(false);
	}

	public submitSearch(event: Event): void {
		event.preventDefault();
		const search = normalizeReviewSearch(
			this.searchDraft(),
			this.searchModeDraft(),
		);
		if (search === null) {
			this.searchError.set(true);
			return;
		}
		this.applySearch(search, search ? this.searchModeDraft() : 'exact');
	}

	public clearSearch(): void {
		this.applySearch('', 'exact');
	}

	public updateSearchMode(value: string): void {
		this.searchModeDraft.set(
			value === 'email-prefix' ? 'email-prefix' : 'exact',
		);
		this.searchError.set(false);
	}

	private applySearch(search: string, mode: ReviewSearchMode): void {
		this.updateSearch(search);
		if (search === this.search() && mode === this.searchMode()) return;
		this.resetQueue();
		this.search.set(search);
		this.searchMode.set(mode);
	}

	private resetQueue(): void {
		this.selectedId.set(undefined);
		this.clearNote();
		this.cursorTrail.set([]);
	}

	public next(): void {
		const listing = this.listing();
		if (listing.state !== 'ready' || !listing.value.nextCursor) return;
		const cursor = listing.value.nextCursor;
		if (this.cursorTrail().includes(cursor)) return;
		this.selectedId.set(undefined);
		this.clearNote();
		this.cursorTrail.update((trail) => [...trail, cursor]);
	}

	public previous(): void {
		if (this.pageNumber() === 1) return;
		this.selectedId.set(undefined);
		this.clearNote();
		this.cursorTrail.update((trail) => trail.slice(0, -1));
	}

	public open(id: string): void {
		if (id !== this.selectedId()) this.clearNote();
		this.selectedId.set(id);
	}

	public retryList(): void {
		this.listAttempt.update((current) => current + 1);
	}

	public retryDetail(): void {
		this.detailAttempt.update((current) => current + 1);
	}

	public appendNote(): void {
		const reader = this.reader;
		const id = this.selectedId();
		const text = normalizeReviewNote(this.note());
		if (
			!id ||
			!text ||
			!reader?.appendNote ||
			!this.notesWritable() ||
			this.noteSaving()
		)
			return;
		this.noteError.set(false);
		this.noteSaving.set(true);
		const previous = this.noteIntent;
		const intent =
			previous?.id === id && previous.text === text
				? previous
				: { id, text, noteId: crypto.randomUUID() };
		this.noteIntent = intent;
		defer(() => reader.appendNote?.(intent) ?? of())
			.pipe(
				take(1),
				takeUntilDestroyed(this.destroyRef),
				finalize(() => this.noteSaving.set(false)),
			)
			.subscribe({
				next: () => {
					if (id !== this.selectedId() || !this.available()) return;
					this.note.set('');
					this.noteIntent = null;
					this.retryDetail();
				},
				error: () => {
					if (id === this.selectedId() && this.available())
						this.noteError.set(true);
				},
			});
	}

	public updateStatusDraft(value: string): void {
		this.statusDraft.set(
			this.statusOptions.find((option) => option === value) ?? null,
		);
		this.statusError.set(false);
	}

	public saveStatus(): void {
		const reader = this.reader;
		const id = this.selectedId();
		const current = this.detail();
		const status = this.statusDraft();
		if (
			!id ||
			!status ||
			!reader?.setStatus ||
			!this.statusWritable() ||
			this.statusSaving() ||
			this.finishNoteFirst() ||
			current.state !== 'ready' ||
			current.value.id !== id ||
			current.value.status === status
		)
			return;
		this.statusError.set(false);
		this.statusSaving.set(true);
		defer(() => reader.setStatus?.({ id, status }) ?? of())
			.pipe(
				take(1),
				takeUntilDestroyed(this.destroyRef),
				finalize(() => this.statusSaving.set(false)),
			)
			.subscribe({
				next: () => {
					if (id !== this.selectedId() || !this.available()) return;
					this.statusDraft.set(null);
					if (this.leavesScope(status)) {
						this.resetQueue();
						this.queueTitle()?.nativeElement.focus();
					}
					this.refreshAfterAction(
						status === 'resolved'
							? 'Review resolved. Find this case under Resolved or All.'
							: 'Review status updated.',
					);
				},
				error: () => {
					if (id === this.selectedId() && this.available())
						this.statusError.set(true);
				},
			});
	}

	public refreshAfterAction(message: string): void {
		this.feedback.set(message);
		this.retryList();
		this.retryDetail();
	}

	private leavesScope(status: ReviewQueueStatus): boolean {
		return (
			(status === 'resolved' && this.scope() === 'open') ||
			(status !== 'resolved' && this.scope() === 'resolved')
		);
	}

	public includedChildCount(children: readonly ReviewCaseChild[]): number {
		return children.filter(
			(child) => child.removed !== true && child.enabled !== false,
		).length;
	}

	private clearNote(): void {
		this.statusDraft.set(null);
		this.noteIntent = null;
		this.feedback.set('');
		this.statusError.set(false);
		this.note.set('');
		this.noteError.set(false);
	}

	public formatAppointment(value: string): string {
		if (!value) return 'Not available';
		return /^\d{4}-\d{2}-\d{2}T/u.test(value)
			? this.formatTime(value)
			: value;
	}

	public formatTime(iso: string): string {
		const time = new Date(iso);
		return Number.isFinite(time.getTime())
			? new Intl.DateTimeFormat('en-US', {
					dateStyle: 'medium',
					timeStyle: 'short',
					timeZone: 'America/Denver',
				}).format(time) + ' MT'
			: 'Not available';
	}
}
