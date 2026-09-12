import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { ByNamePage } from './by-name.page';

const meta = {
	title: 'Admin/Search/By Name and ZIP',
	component: ByNamePage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Customer search form that requires a last name and a five-digit ZIP code.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const search = canvas.getByText('Search').closest('ion-button');
		await expect(canvas.getByText('Search: Last Name & Zip')).toBeVisible();
		await expect(search).toHaveAttribute('disabled');
		await userEvent.click(canvas.getByText('Reset'));
	},
} satisfies Meta<typeof ByNamePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyForm: Story = {};
