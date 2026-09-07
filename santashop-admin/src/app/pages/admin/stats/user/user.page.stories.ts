import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { UserPage } from './user.page';

const meta = {
	title: 'Admin/Reports/User Statistics',
	component: UserPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Yearly user report with the ten most common referral sources and ZIP codes.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText('Top 10 Referrers')).toBeVisible();
		await expect(canvas.getByText('Top 10 Zip Codes')).toBeVisible();
		await userEvent.click(canvas.getByText('Refresh report'));
	},
} satisfies Meta<typeof UserPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentSeason: Story = {};

export const NoUserStatistics: Story = {
	decorators: adminStoryDecorators({ emptyStats: true }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText('No user statistics for this year.')).toBeVisible();
	},
};
