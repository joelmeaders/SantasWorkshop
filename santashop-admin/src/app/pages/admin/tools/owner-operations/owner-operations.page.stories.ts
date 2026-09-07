import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { OwnerOperationsPage } from './owner-operations.page';

const meta = {
	title: 'Admin/Tools/Owner Operations',
	component: OwnerOperationsPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Protected owner workflow. Every operation requires a server preview, account password, and exact confirmation phrase before it starts.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Protected operations')).toBeVisible();
		await userEvent.click(canvas.getByText('Preview operation'));
		await expect(await canvas.findByText('Preview')).toBeVisible();
		await expect(canvas.getByText('QUEUE 42 REMINDERS')).toBeVisible();
		await expect(canvas.getByText('Start protected operation').closest('ion-button')).toHaveAttribute(
			'disabled',
		);
	},
} satisfies Meta<OwnerOperationsPage>;

export default meta;
type Story = StoryObj<OwnerOperationsPage>;

export const ReminderQueuePreview: Story = {};
