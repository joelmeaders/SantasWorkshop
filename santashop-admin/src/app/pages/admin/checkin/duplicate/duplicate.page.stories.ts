import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { DuplicatePage } from './duplicate.page';

const meta = {
	title: 'Admin/Check-In/Blocked Scan',
	component: DuplicatePage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'High-visibility blocked-scan state with the current attempt and original check-in timeline. It prevents ticket or coupon issuance.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('alert')).toHaveTextContent(
			'Suspicious duplicate scan',
		);
		await expect(canvas.getByText('Do not issue tickets or coupons.')).toBeVisible();
		await expect(canvas.getByRole('list', { name: 'Blocked scan timeline' })).toBeVisible();
	},
} satisfies Meta<typeof DuplicatePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SuspiciousDuplicate: Story = {};
