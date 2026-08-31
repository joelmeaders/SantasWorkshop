import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	OnDestroy,
	ViewChild,
	effect,
	input,
	output,
} from '@angular/core';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { html } from '@codemirror/lang-html';
import { basicSetup } from 'codemirror';

@Component({
	selector: 'admin-email-template-code-editor',
	template: '<div #editorHost class="editor-host"></div>',
	styleUrl: './email-template-code-editor.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailTemplateCodeEditorComponent
	implements AfterViewInit, OnDestroy
{
	public readonly value = input('');
	public readonly valueChange = output<string>();

	@ViewChild('editorHost', { static: true })
	private readonly editorHost?: ElementRef<HTMLDivElement>;

	private editorView?: EditorView;

	private readonly syncEditorEffect = effect(() => {
		const nextValue = this.value();
		if (!this.editorView) {
			return;
		}

		const currentValue = this.editorView.state.doc.toString();
		if (currentValue === nextValue) {
			return;
		}

		this.editorView.dispatch({
			changes: {
				from: 0,
				to: this.editorView.state.doc.length,
				insert: nextValue,
			},
		});
	});

	public ngAfterViewInit(): void {
		if (!this.editorHost) {
			return;
		}

		this.editorView = new EditorView({
			state: EditorState.create({
				doc: this.value(),
				extensions: [
					basicSetup,
					html(),
					EditorView.lineWrapping,
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							this.valueChange.emit(
								update.state.doc.toString(),
							);
						}
					}),
				],
			}),
			parent: this.editorHost.nativeElement,
		});
	}

	public ngOnDestroy(): void {
		this.syncEditorEffect.destroy();
		this.editorView?.destroy();
	}
}
