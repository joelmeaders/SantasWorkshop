import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
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
