import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	getAdminStoryFixtures,
} from '../../../../../../../.storybook/admin/admin-story.providers';
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
		const fixtures = getAdminStoryFixtures(canvasElement);
		const loadedStats = fixtures.userStats$.value;
		fixtures.userStats$.next(undefined);
		await userEvent.click(canvas.getByText('Refresh report'));
		await expect(
			canvas.getByText('No user statistics for this year.'),
		).toBeVisible();
		fixtures.userStats$.next(loadedStats);
		await userEvent.click(canvas.getByText('Refresh report'));
		await waitFor(() =>
			expect(canvas.getByText('Top 10 Referrers')).toBeVisible(),
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
				name: 'Profile records observed by creation day',
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole('table', { name: 'User referrals' }),
		).toBeVisible();
		await expect(
			canvas.getByText('Counts include all current user profiles.', {
				exact: false,
			}),
		).toBeVisible();
		canvas
			.getByRole('table', {
				name: 'Profile records observed by creation day',
			})
			.scrollIntoView({ block: 'start', behavior: 'instant' });
	},
};

export const NoUserStatistics: Story = {
	decorators: adminStoryDecorators({ emptyStats: true }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('No user statistics for this year.'),
		).toBeVisible();
	},
};
