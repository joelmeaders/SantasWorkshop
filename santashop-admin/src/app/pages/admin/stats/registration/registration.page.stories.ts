import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	getAdminStoryFixtures,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { RegistrationPage } from './registration.page';

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
		await expect(await canvas.findByText('Registrations')).toBeVisible();
		await expect(canvas.getByText('Capacity by Day')).toBeVisible();
		await expect(canvas.getByText('Schedules by Day')).toBeVisible();
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
			canvas.getByText('No schedule data for this year'),
		).toBeVisible();
		fixtures.registrationStats$.next(loadedStats);
		fixtures.scheduleStats$.next(loadedSchedule);
		fixtures.slots$.next(loadedSlots);
		await userEvent.click(canvas.getByText('Refresh report'));
		await waitFor(() =>
			expect(canvas.getByText('Capacity by Day')).toBeVisible(),
		);
	},
} satisfies Meta<typeof RegistrationPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CurrentSeason: Story = {
	decorators: adminStoryDecorators(),
};

export const NoReportData: Story = {
	decorators: adminStoryDecorators({ emptyStats: true }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText('Registrations')).toBeVisible();
		await expect(canvas.getAllByText('0').length).toBeGreaterThan(0);
		await expect(canvas.queryByText('Capacity by Day')).not.toBeInTheDocument();
	},
};
