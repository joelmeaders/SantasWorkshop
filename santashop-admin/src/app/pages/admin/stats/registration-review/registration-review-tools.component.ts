import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	computed,
	effect,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import {
	REGISTRATION_REVIEW_REASON_CODES,
	isRegistrationReviewChildAction,
	isRegistrationReviewReason,
	type RegistrationReviewReasonCode,
} from '@santashop/models';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { defer, finalize, of, take } from 'rxjs';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import {
	REGISTRATION_REVIEW_READER,
	canReadRegistrationReview,
	type ReviewCaseChild,
	type ReviewCaseRegistration,
	type ReviewClaims,
	type ReviewMutationAction,
	type ReviewMutationRequest,
} from './registration-review-reader';

export const reviewActionLabels: Record<ReviewMutationAction, string> = {
	contact: 'Contact shopper',
	editChild: 'Edit child',
	removeChild: 'Remove child from registration',
	restoreChild: 'Restore child to registration',
	disable: 'Disable shopper access',
	enable: 'Restore shopper access',
	cancel: 'Cancel registration',
	reinstate: 'Reinstate registration',
	blacklist: 'Block email for future seasons',
	unblacklist: 'Remove email block',
};

const reasonLabels: Record<RegistrationReviewReasonCode, string> = {
	'duplicate-registration': 'Duplicate registration',
	'both-parents-registered-same-children':
		'Same children registered by both parents',
	'suspected-automated-signup': 'Suspected automated signup',
	'registration-information-unverified':
		"Registration information couldn't be verified",
	'reviewed-and-cleared': 'Reviewed and cleared',
	'verify-registration': 'Verify registration information',
	'follow-up': 'Follow up on this review',
	'correct-child-information': 'Correct child information',
	'duplicate-child-entry': 'Duplicate child entry',
	'child-removed-in-error': 'Child removed in error',
	'cancellation-requested-by-shopper': 'Cancellation requested by shopper',
	'cancellation-in-error': 'Registration canceled in error',
	'block-in-error': 'Email blocked in error',
};

interface ActionOption {
	readonly action: ReviewMutationAction;
	readonly record: ReviewCaseRegistration;
	readonly child?: ReviewCaseChild;
}

@Component({
	selector: 'admin-registration-review-tools',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [AdminTextPipe, NgTemplateOutlet],
	templateUrl: './registration-review-tools.component.html',
	styleUrl: './registration-review-tools.component.scss',
})
export class RegistrationReviewToolsComponent {
	private readonly reader = inject(REGISTRATION_REVIEW_READER, {
		optional: true,
	});
	private readonly destroyRef = inject(DestroyRef);
	public readonly caseId = input.required<string>();
	public readonly record = input.required<ReviewCaseRegistration>();
	public readonly claims = input<ReviewClaims>();
	public readonly updated = output<string>();
	public readonly labels = reviewActionLabels;
	public readonly reasonLabels = reasonLabels;
	public readonly reasonChoices = REGISTRATION_REVIEW_REASON_CODES;
	public readonly isChildAction = isRegistrationReviewChildAction;
	public readonly replyTo = 'president@denversantaclausshop.org';
	public readonly prompt = signal<ActionOption | null>(null);
	public readonly reason = signal('');
	public readonly notify = signal(false);
	public readonly message = signal('');
	public readonly firstName = signal('');
	public readonly lastName = signal('');
	public readonly birthDate = signal('');
	public readonly pending = signal(false);
	public readonly error = signal('');
	private readonly attempt = signal<ReviewMutationRequest | null>(null);
	private readonly dialog =
		viewChild<ElementRef<HTMLDialogElement>>('actionDialog');

	public readonly steps = computed(() =>
		this.options([
			'contact',
			'editChild',
			'removeChild',
			'disable',
			'cancel',
			'blacklist',
		]),
	);
	public readonly recovery = computed(() =>
		this.options(['restoreChild', 'enable', 'reinstate', 'unblacklist']),
	);
	public readonly registrationSteps = computed(() =>
		this.steps().filter((option) => !option.child),
	);
	public readonly registrationRecovery = computed(() =>
		this.recovery().filter((option) => !option.child),
	);
	public readonly childActions = computed(() => {
		const grouped = new Map<ReviewCaseChild, ActionOption[]>();
		for (const option of [...this.steps(), ...this.recovery()]) {
			if (!option.child) continue;
			const options = grouped.get(option.child);
			if (options) options.push(option);
			else grouped.set(option.child, [option]);
		}
		return [...grouped].map(([child, options]) => ({ child, options }));
	});
	public readonly canConfirm = computed(() => {
		const option = this.prompt();
		if (
			!option ||
			!isRegistrationReviewReason(option.action, this.reason()) ||
			this.pending()
		)
			return false;
		if (option.action === 'editChild')
			return (
				!!this.firstName().trim() &&
				!!this.lastName().trim() &&
				/^\d{4}-\d{2}-\d{2}$/u.test(this.birthDate())
			);
		return true;
	});

	constructor() {
		effect(() => {
			const entry = this.prompt();
			const dialog = this.dialog()?.nativeElement;
			if (entry && dialog && !dialog.open) dialog.showModal();
		});
	}

	private options(
		actions: readonly ReviewMutationAction[],
	): readonly ActionOption[] {
		if (
			!this.reader?.performAction ||
			!canReadRegistrationReview(this.claims())
		)
			return [];
		const record = this.record();
		const choices: ActionOption[] = [];
		for (const action of actions) {
			if (
				!record?.expectedRevision ||
				!record.availableActions?.includes(action)
			)
				continue;
			if (action === 'contact' && !record.email) continue;
			if (
				action === 'editChild' ||
				action === 'removeChild' ||
				action === 'restoreChild'
			) {
				for (const child of record.children) {
					if (
						child.childIndex === undefined ||
						(child.removed === true || child.enabled === false) !==
							(action === 'restoreChild')
					)
						continue;
					choices.push({ action, record, child });
				}
			} else {
				choices.push({ action, record });
			}
		}
		return choices;
	}

	public actionLabel(option: ActionOption): string {
		return this.labels[option.action];
	}

	public open(option: ActionOption): void {
		this.prompt.set(option);
		this.reason.set(
			option.action === 'enable' ? 'reviewed-and-cleared' : '',
		);
		this.notify.set(option.action === 'contact');
		this.message.set('');
		this.error.set('');
		this.attempt.set(null);
		this.firstName.set(option.child?.firstName ?? '');
		this.lastName.set(option.child?.lastName ?? '');
		this.birthDate.set(option.child?.birthDate ?? '');
	}

	public close(event?: Event): void {
		event?.preventDefault();
		if (this.pending()) return;
		this.dialog()?.nativeElement.close();
		this.attempt.set(null);
		this.prompt.set(null);
	}

	public confirm(event: Event): void {
		event.preventDefault();
		const option = this.prompt();
		const reader = this.reader;
		const current = this.record();
		if (
			!option ||
			current.id !== option.record.id ||
			!current.expectedRevision ||
			!reader?.performAction ||
			!this.canConfirm() ||
			!canReadRegistrationReview(this.claims())
		)
			return;
		if (
			current.expectedRevision !== option.record.expectedRevision ||
			!current.availableActions?.includes(option.action)
		) {
			this.error.set(
				'Registration changed. Close this dialog and reload the case.',
			);
			return;
		}
		const notification =
			!this.isChildAction(option.action) &&
			(option.action === 'contact' || this.notify());
		if (notification && !current.email) return;
		const customMessage = this.message().trim();
		const request: ReviewMutationRequest = {
			caseId: this.caseId(),
			registrationId: current.id,
			expectedRevision: current.expectedRevision,
			mutationId: '',
			action: option.action,
			reason: this.reason(),
			...(notification
				? {
						notification: {
							recipient: current.email,
							...(customMessage ? { customMessage } : {}),
						},
					}
				: {}),
			...(option.child?.childIndex !== undefined
				? { childIndex: option.child.childIndex }
				: {}),
			...(option.action === 'editChild'
				? {
						child: {
							firstName: this.firstName().trim(),
							lastName: this.lastName().trim(),
							birthDate: this.birthDate(),
						},
					}
				: {}),
		};
		const previous = this.attempt();
		const submission = {
			...request,
			mutationId:
				previous &&
				JSON.stringify({ ...previous, mutationId: '' }) ===
					JSON.stringify(request)
					? previous.mutationId
					: crypto.randomUUID(),
		};
		this.attempt.set(submission);
		this.error.set('');
		this.pending.set(true);
		defer(() => reader.performAction?.(submission) ?? of())
			.pipe(
				take(1),
				takeUntilDestroyed(this.destroyRef),
				finalize(() => this.pending.set(false)),
			)
			.subscribe({
				next: (result) => {
					this.pending.set(false);
					this.close();
					if (result.authAccess === 'requires-manual-review') {
						this.updated.emit(
							result.notification === 'queued'
								? 'Email block removed. Shopper email queued. Verify sign-in separately.'
								: 'Email block removed. Verify sign-in separately.',
						);
						return;
					}
					this.updated.emit(
						result.notification === 'queued'
							? 'Action recorded. Shopper email queued.'
							: 'Action recorded. No shopper email was requested.',
					);
				},
				error: (failure: unknown) => {
					if (
						option.action === 'blacklist' &&
						this.blockActive(failure)
					) {
						this.error.set(
							'The email block is active, but sign-in restriction could not be verified. Retry the same request without changing it.',
						);
						return;
					}
					this.error.set(
						'The action was not confirmed. Retry unchanged to check the same request, or close and reload the case.',
					);
				},
			});
	}

	private blockActive(failure: unknown): boolean {
		if (!failure || typeof failure !== 'object' || !('details' in failure))
			return false;
		const details = failure.details;
		return (
			!!details &&
			typeof details === 'object' &&
			'reviewActionState' in details &&
			details.reviewActionState === 'block-active-auth-unverified'
		);
	}
}
