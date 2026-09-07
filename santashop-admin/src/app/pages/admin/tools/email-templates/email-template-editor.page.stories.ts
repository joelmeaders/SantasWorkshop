import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	adminStoryDecorators,
	enterIonicStoryPage,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { EmailTemplateEditorPage } from './email-template-editor.page';

const meta = {
	title: 'Admin/Email Templates/Template Editor',
	component: EmailTemplateEditorPage,
	decorators: adminStoryDecorators({
		routeParams: { key: 'event-reminder-2026-en' },
	}),
	parameters: {
		docs: {
			description: {
				component:
					'Complete email-template editor with SES metadata, HTML, text fallback, runtime fields, live preview, test delivery, revisions, and publishing.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await enterIonicStoryPage<EmailTemplateEditorPage>(
			canvasElement,
			'admin-email-template-editor',
		);
		await expect(await canvas.findByText('Edit Email Template')).toBeVisible();
		await expect(canvas.getByText('Revisions')).toBeVisible();
		await expect(canvas.getByText('Revision r3')).toBeVisible();
		await userEvent.click(canvas.getByText('Refresh Preview'));
	},
} satisfies Meta<EmailTemplateEditorPage>;

export default meta;
type Story = StoryObj<EmailTemplateEditorPage>;

export const PublishedReminder: Story = {};

export const NewTemplate: Story = {
	decorators: adminStoryDecorators({ routeParams: {} }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await enterIonicStoryPage<EmailTemplateEditorPage>(
			canvasElement,
			'admin-email-template-editor',
		);
		await expect(await canvas.findByText('Create Email Template')).toBeVisible();
		await expect(canvas.getByText('Save your first revision to start history.')).toBeVisible();
	},
};
