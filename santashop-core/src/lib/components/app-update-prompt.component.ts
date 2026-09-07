import {
	ChangeDetectionStrategy,
	Component,
	Input,
	inject,
} from '@angular/core';
import {
	AppUpdateNotice,
	AppUpdateService,
} from '../services/app-update.service';

export interface AppUpdatePromptCopy {
	readyTitle: string;
	readyMessage: string;
	failedTitle: string;
	failedMessage: string;
	unrecoverableTitle: string;
	unrecoverableMessage: string;
	reloadLabel: string;
	laterLabel: string;
}

export const DEFAULT_APP_UPDATE_PROMPT_COPY: AppUpdatePromptCopy = {
	readyTitle: 'A fresh update is ready',
	readyMessage:
		'You can keep going and update later. Refreshing now may erase information you have not saved.',
	failedTitle: 'The update will have to wait',
	failedMessage:
		'We could not finish the update. You can keep using the site and try refreshing later.',
	unrecoverableTitle: 'Please refresh to continue',
	unrecoverableMessage:
		'Sorry, this page needs a fresh start. Refresh to continue. You may need to enter information you have not saved again.',
	reloadLabel: 'Refresh page',
	laterLabel: 'Not now',
};

@Component({
	selector: 'core-app-update-prompt',
	standalone: true,
	template: `
		@if (updateService.notice(); as notice) {
			<div
				class="app-update-prompt"
				role="status"
				aria-live="polite"
				[attr.aria-labelledby]="'app-update-title'"
			>
				<h2 id="app-update-title">{{ titleFor(notice) }}</h2>
				<p>{{ messageFor(notice) }}</p>
				<div class="app-update-actions">
					@if (notice !== 'unrecoverable') {
						<button type="button" (click)="updateService.dismiss()">
							{{ copy.laterLabel }}
						</button>
					}
					<button
						type="button"
						class="primary"
						(click)="updateService.reload()"
					>
						{{ copy.reloadLabel }}
					</button>
				</div>
			</div>
		}
	`,
	styles: [
		`
			.app-update-prompt {
				position: fixed;
				inset-inline: 1rem;
				bottom: 1rem;
				z-index: 1000;
				max-width: 36rem;
				margin-inline: auto;
				padding: 1rem;
				color: #17211c;
				background: #fffdf8;
				border: 2px solid #155344;
				border-radius: 0.75rem;
				box-shadow: 0 0.5rem 2rem rgb(0 0 0 / 25%);
			}

			.app-update-prompt h2 {
				margin: 0 0 0.5rem;
				font-size: 1.1rem;
			}

			.app-update-prompt p {
				margin: 0;
				line-height: 1.45;
			}

			.app-update-actions {
				display: flex;
				justify-content: flex-end;
				gap: 0.75rem;
				margin-top: 0.9rem;
			}

			.app-update-actions button {
				min-height: 2.75rem;
				padding: 0.5rem 1rem;
				color: #155344;
				background: transparent;
				border: 1px solid #155344;
				border-radius: 0.5rem;
				font: inherit;
				font-weight: 700;
				cursor: pointer;
			}

			.app-update-actions button:focus-visible {
				outline: 3px solid #bd954a;
				outline-offset: 2px;
			}

			.app-update-actions button.primary {
				color: #fff;
				background: #155344;
			}

			@media (min-width: 40rem) {
				.app-update-prompt {
					inset-inline-start: auto;
					inset-inline-end: 1rem;
					margin-inline: 0;
				}
			}
		`,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppUpdatePromptComponent {
	private readonly service = inject(AppUpdateService);

	@Input() public copy: AppUpdatePromptCopy = DEFAULT_APP_UPDATE_PROMPT_COPY;

	public readonly updateService = this.service;

	public titleFor(notice: Exclude<AppUpdateNotice, null>): string {
		if (notice === 'ready') return this.copy.readyTitle;
		if (notice === 'failed') return this.copy.failedTitle;
		return this.copy.unrecoverableTitle;
	}

	public messageFor(notice: Exclude<AppUpdateNotice, null>): string {
		if (notice === 'ready') return this.copy.readyMessage;
		if (notice === 'failed') return this.copy.failedMessage;
		return this.copy.unrecoverableMessage;
	}
}
