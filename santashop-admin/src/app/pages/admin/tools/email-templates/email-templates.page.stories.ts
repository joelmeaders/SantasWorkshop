import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	adminStoryDecorators,
	enterIonicStoryPage,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { EmailTemplatesPage } from './email-templates.page';

const meta = {
	title: 'Admin/Email Templates/Template List',
	component: EmailTemplatesPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Email-template catalog with delivery profile, language, revision, and publish state for every SES template.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await enterIonicStoryPage<EmailTemplatesPage>(
			canvasElement,
			'admin-email-templates',
		);
		await expect(
			await canvas.findByText('2026 Event Reminder (English) · English'),
		).toBeVisible();
		await expect(canvas.getByText('Published')).toBeVisible();
		await userEvent.click(canvas.getByTitle('Create template'));
	},
} satisfies Meta<EmailTemplatesPage>;

export default meta;
type Story = StoryObj<EmailTemplatesPage>;

export const PublishedTemplate: Story = {};

export const EmptyCatalog: Story = {
	decorators: adminStoryDecorators({ emailTemplates: [] }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await enterIonicStoryPage<EmailTemplatesPage>(
			canvasElement,
			'admin-email-templates',
		);
		await expect(
			await canvas.findByText(/No email templates yet/),
		).toBeVisible();
	},
};
