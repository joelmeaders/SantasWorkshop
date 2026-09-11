import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	getAdminStoryFixtures,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { scrollToReportTable } from '../../../../../../../.storybook/admin/report-story.helpers';
import { UserPage } from './user.page';

const meta = {
	id: 'admin-reports-user-statistics',
	title: 'Admin/Reports/Shopper Statistics',
	component: UserPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Shopper charts appear first, followed by tables with short label explanations and downloads.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('How Shoppers Heard About Us'),
		).toBeVisible();
		await expect(canvas.getByText('Top 10 ZIP Codes')).toBeVisible();
		await userEvent.click(canvas.getByText('Refresh report'));
		const fixtures = getAdminStoryFixtures(canvasElement);
		const loadedStats = fixtures.userStats$.value;
		fixtures.userStats$.next(undefined);
		await userEvent.click(canvas.getByText('Refresh report'));
		await expect(
			canvas.getByText('No shopper data for this year.'),
		).toBeVisible();
		fixtures.userStats$.next(loadedStats);
		await userEvent.click(canvas.getByText('Refresh report'));
		await waitFor(() =>
			expect(
				canvas.getByText('How Shoppers Heard About Us'),
			).toBeVisible(),
		);
	},
} satisfies Meta<typeof UserPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentSeason: Story = {};

export const SavedProfileHistory: Story = {
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const fixtures = getAdminStoryFixtures(canvasElement);
		fixtures.userStats$.next({
			totalUsers: 116,
			schemaVersion: 2,
			population: 'all-users',
			programYear: 2026,
			calculatedAt: new Date('2026-09-03T06:00:00Z'),
			signupCoverage: 'observed-profile-records',
			referrerCount: [
				{ referrer: 'School', count: 60 },
				{ referrer: 'Friend or family', count: 40 },
				{ referrer: 'Unknown', count: 16 },
			],
			zipCodeCount: [
				{ zip: '80219', count: 60 },
				{ zip: '80204', count: 40 },
				{ zip: 'Unknown', count: 16 },
			],
			dailySignups: [
				{ dateKey: '2026-09-01', count: 60 },
				{ dateKey: '2026-09-02', count: 36 },
				{ dateKey: '2026-09-03', count: 20 },
			],
			signupDatesUnavailable: 0,
			signupDatesOutsideProgramYear: 0,
		});
		await userEvent.click(canvas.getByText('Refresh report'));
		await expect(
			await canvas.findByRole('table', {
				name: 'Shopper profiles by day',
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole('table', { name: 'Shopper referrals' }),
		).toBeVisible();
		await expect(
			canvas.getByText('Includes all saved shopper profiles.', {
				exact: false,
			}),
		).toBeVisible();
		await scrollToReportTable(
			canvas.getByRole('table', {
				name: 'Shopper profiles by day',
			}),
		);
	},
};

export const NoUserStatistics: Story = {
	decorators: adminStoryDecorators({ emptyStats: true }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('No shopper data for this year.'),
		).toBeVisible();
	},
};
