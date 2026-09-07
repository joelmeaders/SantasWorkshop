import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { EmailTemplateCodeEditorComponent } from './email-template-code-editor.component';

const meta = {
	title: 'Admin/Email Templates/HTML Code Editor',
	component: EmailTemplateCodeEditorComponent,
	decorators: adminStoryDecorators(),
	args: {
		value: '<h1>Hello {{firstName}}</h1>\n<p>Your visit is {{dateTime}}.</p>',
	},
	parameters: {
		docs: {
			description: {
				component:
					'CodeMirror HTML editor used for email-template source. It supports line wrapping and emits each document change.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const editor = await canvas.findByRole('textbox');
		await expect(editor).toHaveTextContent('Hello {{firstName}}');
		await userEvent.click(editor);
		await userEvent.keyboard('{End}');
	},
} satisfies Meta<EmailTemplateCodeEditorComponent>;

export default meta;
type Story = StoryObj<EmailTemplateCodeEditorComponent>;

export const ReminderMarkup: Story = {};
