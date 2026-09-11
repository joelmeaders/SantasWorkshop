import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	getAdminStoryFixtures,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { scrollToReportTable } from '../../../../../../../.storybook/admin/report-story.helpers';
import { RegistrationPage } from './registration.page';
import { type RegistrationOperationalStats } from '@santashop/models';

const meta = {
	title: 'Admin/Reports/Registration Statistics',
	component: RegistrationPage,
	parameters: {
		docs: {
			description: {
				component:
					'Yearly registration report with capacity, appointment, child, gender, and ZIP-code data from the production page.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByRole('heading', {
				name: 'Registrations',
			}),
		).toBeVisible();
		await expect(
			canvas.getByRole('heading', { name: 'Capacity by Day' }),
		).toBeVisible();
		await expect(
			canvas.getByRole('heading', { name: 'Appointments by Day' }),
		).toBeVisible();
		await userEvent.click(canvas.getByText('Refresh report'));
		const fixtures = getAdminStoryFixtures(canvasElement);
		const loadedStats = fixtures.registrationStats$.value;
		const loadedSchedule = fixtures.scheduleStats$.value;
		const loadedSlots = fixtures.slots$.value;
		fixtures.registrationStats$.next(undefined);
		fixtures.scheduleStats$.next(undefined);
		fixtures.slots$.next([]);
		await userEvent.click(canvas.getByText('Refresh report'));
		await expect(
			canvas.getByText('No appointment data for this year'),
		).toBeVisible();
		fixtures.registrationStats$.next(loadedStats);
		fixtures.scheduleStats$.next(loadedSchedule);
		fixtures.slots$.next(loadedSlots);
		await userEvent.click(canvas.getByText('Refresh report'));
		await waitFor(() =>
			expect(
				canvas.getByRole('heading', { name: 'Capacity by Day' }),
			).toBeVisible(),
		);
	},
} satisfies Meta<typeof RegistrationPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentSeason: Story = {
	decorators: adminStoryDecorators(),
};

export const SavedOutcomeCalculations: Story = {
	decorators: adminStoryDecorators(),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const fixtures = getAdminStoryFixtures(canvasElement);
		const saved = fixtures.registrationStats$.value;
		if (!saved)
			throw new Error('The registration report fixture is required.');
		const operational: RegistrationOperationalStats = {
			coverage: 'current-records',
			registrationRecords: 80,
			submittedRegistrations: 64,
			draftRegistrations: 12,
			cancelledRegistrations: 4,
			recordedCancellationEvents: 6,
			checkedInRegistrations: 0,
			pastAppointmentRegistrations: 0,
			attendedPastAppointments: 0,
			unconfirmedPastAppointments: 0,
			attendanceStatusUnavailable: 0,
			missingAppointmentRegistrations: 0,
			invalidSubmissionDates: 0,
			completionRate: 0.8,
		};
		fixtures.registrationStats$.next({
			...saved,
			schemaVersion: 2,
			programYear: 2026,
			calculatedAt: new Date('2026-09-03T06:00:00Z'),
			operational,
			zipCodeCount: [
				{ zip: 80204, count: 19, childCount: 38 },
				{ zip: 80211, count: 14, childCount: 27 },
				{ zip: 80219, count: 12, childCount: 20 },
				{ zip: 80205, count: 10, childCount: 18 },
				{ zip: 80216, count: 5, childCount: 8 },
				{ zip: 80223, count: 4, childCount: 7 },
			],
			dailySnapshots: [
				{
					...operational,
					dateKey: '2026-09-01',
					calculatedAt: new Date('2026-09-01T06:00:00Z'),
					registrationRecords: 60,
					submittedRegistrations: 48,
					draftRegistrations: 8,
				},
				{
					...operational,
					dateKey: '2026-09-02',
					calculatedAt: new Date('2026-09-02T06:00:00Z'),
					registrationRecords: 70,
					submittedRegistrations: 56,
					draftRegistrations: 10,
				},
				{
					...operational,
					dateKey: '2026-09-03',
					calculatedAt: new Date('2026-09-03T06:00:00Z'),
				},
			],
		});
		await userEvent.click(canvas.getByText('Refresh report'));
		await expect(
			await canvas.findByRole('table', { name: 'Registration progress' }),
		).toBeVisible();
		await expect(
			canvas.getByRole('table', { name: 'Daily registration totals' }),
		).toBeVisible();
		await expect(
			within(
				canvas.getByRole('table', { name: 'Registration progress' }),
			).getByText('80.0%'),
		).toBeVisible();
		await scrollToReportTable(
			canvas.getByRole('table', { name: 'Registration progress' }),
		);
	},
};

export const NoReportData: Story = {
	decorators: adminStoryDecorators({ emptyStats: true }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByRole('heading', {
				name: 'Registrations',
			}),
		).toBeVisible();
		await expect(canvas.getAllByText('0').length).toBeGreaterThan(0);
		await expect(
			canvas.queryByRole('heading', { name: 'Capacity by Day' }),
		).not.toBeInTheDocument();
	},
};
