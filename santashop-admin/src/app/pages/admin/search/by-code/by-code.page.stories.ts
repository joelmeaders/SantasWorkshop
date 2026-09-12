import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { ByCodePage } from './by-code.page';

const meta = {
	title: 'Admin/Search/By Registration Code',
	component: ByCodePage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Manual lookup for a seven- or eight-character registration code.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const search = canvas.getByText('Search').closest('ion-button');
		await expect(
			canvas.getByText('Search: Registration Code'),
		).toBeVisible();
		await expect(search).toHaveAttribute('disabled');
		await userEvent.click(canvas.getByText('Reset'));
	},
} satisfies Meta<typeof ByCodePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyForm: Story = {};
