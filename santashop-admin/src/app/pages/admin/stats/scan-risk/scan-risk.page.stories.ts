import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	getAdminStoryFixtures,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { ScanRiskPage } from './scan-risk.page';

const meta = {
	title: 'Admin/Reports/Scan Risk Review',
	component: ScanRiskPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Seasonal queue of late duplicate and canceled-code scans that need staff review.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText('Elena Rivera')).toBeVisible();
		await expect(canvas.getByText('2 risk attempt(s)')).toBeVisible();
		await userEvent.click(canvas.getByText('Refresh scan risks'));
		const fixtures = getAdminStoryFixtures(canvasElement);
		const loadedSummaries = fixtures.riskSummaries$.value;
		fixtures.riskSummaries$.next([]);
		await expect(
			await canvas.findByText('No suspicious scans this season'),
		).toBeVisible();
		fixtures.riskSummaries$.next(loadedSummaries);
		await expect(await canvas.findByText('Elena Rivera')).toBeVisible();
		await waitFor(() =>
			expect(
				canvas.queryByText('No suspicious scans this season'),
			).not.toBeInTheDocument(),
		);
	},
} satisfies Meta<typeof ScanRiskPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SuspiciousScanQueue: Story = {};

export const ClearSeason: Story = {
	decorators: adminStoryDecorators({ riskSummaries: [] }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('No suspicious scans this season'),
		).toBeVisible();
	},
};
