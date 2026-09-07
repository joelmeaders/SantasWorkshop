import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { ScanRiskDetailPage } from './scan-risk-detail.page';

const meta = {
	title: 'Admin/Reports/Customer Scan Timeline',
	component: ScanRiskDetailPage,
	decorators: adminStoryDecorators({
		routeParams: { uid: 'customer-1001' },
	}),
	parameters: {
		docs: {
			description: {
				component:
					'Chronological evidence for one customer, including the successful check-in and each blocked scan attempt.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText('Successful check-in')).toBeVisible();
		await expect(canvas.getByText('duplicate-risk')).toBeVisible();
		await expect(canvas.getByText('Code ending in A101')).toBeVisible();
		await userEvent.click(canvas.getByText('Refresh timeline'));
	},
} satisfies Meta<typeof ScanRiskDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DuplicateAttempt: Story = {};

export const NoBlockedScanAttempts: Story = {
	decorators: adminStoryDecorators({
		riskAttempts: [],
		routeParams: { uid: 'customer-without-history' },
	}),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Successful check-in')).toBeVisible();
	},
};
