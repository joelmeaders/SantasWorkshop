import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	OnDestroy,
	ViewChild,
	effect,
	inject,
	input,
	output,
} from '@angular/core';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { AdminLanguageService } from '../../../../shared/preferences/admin-language.service';
import { AdminThemeService } from '../../../../shared/preferences/admin-theme.service';
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
	private readonly appearance = new Compartment();
	private readonly language = inject(AdminLanguageService);
	private readonly theme = inject(AdminThemeService);
	private readonly appearanceEffect = effect(() => {
		const extensions = this.editorAppearance();
		this.editorView?.dispatch({
			effects: this.appearance.reconfigure(extensions),
		});
	});

	private editorAppearance(): Extension[] {
		return [
			syntaxHighlighting(
				HighlightStyle.define([
					{
						tag: tags.tagName,
						color: this.theme.dark() ? '#94d3bc' : '#186b4e',
					},
					{
						tag: tags.attributeName,
						color: this.theme.dark() ? '#ffb8c2' : '#932037',
					},
					{
						tag: tags.string,
						color: this.theme.dark() ? '#edd193' : '#745516',
					},
					{
						tag: tags.comment,
						color: this.theme.dark() ? '#b7b3ad' : '#655f58',
					},
					{
						tag: [tags.bracket, tags.punctuation],
						color: this.theme.dark() ? '#f4f1ed' : '#242321',
					},
				]),
			),
			EditorView.theme(
				{
					'&': {
						color: 'var(--ion-text-color)',
						backgroundColor: 'var(--admin-surface)',
					},
					'.cm-gutters': {
						color: 'var(--admin-muted)',
						backgroundColor: 'var(--admin-surface-muted)',
						borderColor: 'var(--admin-border)',
					},
					'.cm-activeLine, .cm-activeLineGutter': {
						backgroundColor: 'var(--admin-surface-muted)',
					},
					'.cm-cursor': { borderLeftColor: 'var(--ion-text-color)' },
				},
				{ dark: this.theme.dark() },
			),
			EditorView.contentAttributes.of({
				'aria-label': this.language.text('HTML template source'),
			}),
			EditorState.phrases.of(
				this.language.language() === 'es'
					? {
							Find: 'Buscar',
							Replace: 'Reemplazar',
							'replace all': 'reemplazar todo',
							next: 'siguiente',
							previous: 'anterior',
							'match case': 'distinguir mayúsculas',
							'by word': 'palabra completa',
							'regular expression': 'expresión regular',
							'go to line': 'ir a la línea',
							close: 'cerrar',
						}
					: {},
			),
		];
	}

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
					this.appearance.of(this.editorAppearance()),
					basicSetup,
					html(),
					EditorView.lineWrapping,
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							this.valueChange.emit(update.state.doc.toString());
						}
					}),
				],
			}),
			parent: this.editorHost.nativeElement,
		});
	}

	public ngOnDestroy(): void {
		this.appearanceEffect.destroy();
		this.syncEditorEffect.destroy();
		this.editorView?.destroy();
	}
}
