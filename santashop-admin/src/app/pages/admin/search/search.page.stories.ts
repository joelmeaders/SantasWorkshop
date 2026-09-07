import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../.storybook/admin/admin-story.providers';
import { SearchPage } from './search.page';

const meta = {
	title: 'Admin/Search/Choose Method',
	component: SearchPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'First step of customer lookup. Staff can search by name and ZIP code, email address, or registration code.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Step 1')).toBeVisible();
		await expect(canvas.getByText('Name & Zip Code')).toBeVisible();
		await expect(canvas.getByText('Email Address')).toBeVisible();
		await expect(canvas.getByText('Registration Code')).toBeVisible();
	},
} satisfies Meta<typeof SearchPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchMethods: Story = {};
