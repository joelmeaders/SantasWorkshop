import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	getAdminStoryFixtures,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { CheckInPage } from './check-in.page';

const meta = {
	title: 'Admin/Reports/Check-In Statistics',
	component: CheckInPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Yearly check-in totals and hourly charts for customers, children, pre-registrations, on-site registrations, and edited registrations.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByRole('heading', {
				name: 'Customers',
				exact: true,
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole('heading', { name: 'Children', exact: true }),
		).toBeVisible();
		await expect(
			canvas.getByRole('heading', {
				name: 'Pre-Registered',
				exact: true,
			}),
		).toBeVisible();
		await userEvent.click(
			canvas.getByText(/View by Children|View by Check-Ins/),
		);
		const fixtures = getAdminStoryFixtures(canvasElement);
		const loadedStats = fixtures.checkInStats$.value;
		fixtures.checkInStats$.next(undefined);
		await expect(
			await canvas.findByText(
				'No check-ins have been recorded for this year.',
			),
		).toBeVisible();
		fixtures.checkInStats$.next(loadedStats);
		await expect(
			await canvas.findByRole('heading', {
				name: 'Customers',
				exact: true,
			}),
		).toBeVisible();
		await waitFor(() =>
			expect(
				canvas.queryByText(
					'No check-ins have been recorded for this year.',
				),
			).not.toBeInTheDocument(),
		);
	},
} satisfies Meta<typeof CheckInPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentSeason: Story = {};

export const NoCheckInsYet: Story = {
	decorators: adminStoryDecorators({ emptyStats: true }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText(
				'No check-ins have been recorded for this year.',
			),
		).toBeVisible();
		await userEvent.click(canvas.getByText('Refresh report'));
	},
};
