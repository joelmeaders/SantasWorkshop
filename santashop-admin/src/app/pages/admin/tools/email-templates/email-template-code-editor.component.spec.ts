import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { EmailTemplateCodeEditorComponent } from './email-template-code-editor.component';

describe('EmailTemplateCodeEditorComponent', () => {
	let component: EmailTemplateCodeEditorComponent;
	let fixture: ComponentFixture<EmailTemplateCodeEditorComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [EmailTemplateCodeEditorComponent],
		}).compileComponents();
		fixture = TestBed.createComponent(EmailTemplateCodeEditorComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('value', '<p>Initial</p>');
		await fixture.whenStable();
	});

	it('creates a CodeMirror editor with the provided value and synchronizes later inputs', async () => {
		const editor = (component as unknown as {
			editorView: { state: { doc: { toString: () => string } } };
		}).editorView;
		expect(editor.state.doc.toString()).toBe('<p>Initial</p>');

		fixture.componentRef.setInput('value', '<p>Updated</p>');
		await fixture.whenStable();
		expect(editor.state.doc.toString()).toBe('<p>Updated</p>');
	});

	it('emits document edits and cleans up its editor on destroy', async () => {
		const values: string[] = [];
		component.valueChange.subscribe((value) => values.push(value));
		const editor = (component as unknown as {
			editorView: {
				state: { doc: { length: number } };
				dispatch: (change: unknown) => void;
			};
		}).editorView;

		editor.dispatch({
			changes: { from: 0, to: editor.state.doc.length, insert: '<p>Edited</p>' },
		});
		expect(values).toEqual(['<p>Edited</p>']);
		expect(() => fixture.destroy()).not.toThrow();
	});
});
