import {
	afterRenderEffect,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	input,
	viewChild,
} from '@angular/core';

@Component({
	selector: 'admin-waiting-list-email-preview',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `<iframe
		#frame
		sandbox="allow-popups allow-popups-to-escape-sandbox"
		[title]="title()"
	></iframe>`,
	styles: [
		`
			:host {
				display: block;
			}
			iframe {
				display: block;
				width: 100%;
				height: 760px;
				border: 1px solid var(--ion-color-medium, #777);
				background: white;
			}
		`,
	],
})
export class WaitingListEmailPreviewComponent {
	public readonly html = input.required<string>();
	public readonly title = input('Email preview');
	private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
	constructor() {
		afterRenderEffect(() => {
			const frame = this.frame()?.nativeElement;
			// Match the template editor: preserve email CSS inside a sandbox that cannot run scripts.
			if (frame) frame.srcdoc = this.html();
		});
	}
}
