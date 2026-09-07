import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	getAdminStoryFixtures,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { ConfirmationPage } from './confirmation.page';

const meta = {
	title: 'Admin/Check-In/Confirmation',
	component: ConfirmationPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Successful check-in receipt with the coupon count and registration code staff must use at handoff.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Success!')).toBeVisible();
		await expect(
			canvas.getByText('Give the shopper 2 coupons.'),
		).toBeVisible();
		await expect(canvas.getByText('SW26A101')).toBeVisible();
		const fixtures = getAdminStoryFixtures(canvasElement);
		fixtures.checkInReceipt$.next({ code: 'SW26B202', count: 1 });
		await expect(
			await canvas.findByText('Give the shopper 1 coupon.'),
		).toBeVisible();
		await expect(canvas.getByText('SW26B202')).toBeVisible();
		await waitFor(() =>
			expect(canvas.queryByText('SW26A101')).not.toBeInTheDocument(),
		);
	},
} satisfies Meta<typeof ConfirmationPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoCoupons: Story = {};

export const MissingCheckInRecord: Story = {
	decorators: adminStoryDecorators({ checkIn: null }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('No check in record')).toBeVisible();
		const fixtures = getAdminStoryFixtures(canvasElement);
		fixtures.checkInReceipt$.next({ code: 'SW26B202', count: 1 });
		await expect(await canvas.findByText('Success!')).toBeVisible();
		await waitFor(() =>
			expect(
				canvas.queryByText('No check in record'),
			).not.toBeInTheDocument(),
		);
	},
};
