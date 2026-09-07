import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { ScheduleEditorPage } from './schedule-editor.page';

const meta = {
	title: 'Admin/Tools/Schedule and Capacity Editor',
	component: ScheduleEditorPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Production schedule editor with owner-only generation, bulk changes, capacity states, and per-slot date, time, capacity, and enabled controls.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText('Generate hourly schedules')).toBeVisible();
		await expect(canvas.getByText('At capacity')).toBeVisible();
		await userEvent.click(canvas.getByText('Select all'));
		await expect(canvas.getAllByText('2 selected').length).toBeGreaterThan(0);
		const applyButton = canvas.getByText('Apply to 2 selected').closest('ion-button');
		await expect((applyButton as HTMLIonButtonElement).disabled).toBe(false);
	},
} satisfies Meta<ScheduleEditorPage>;

export default meta;
type Story = StoryObj<ScheduleEditorPage>;

export const OwnerCapacityView: Story = {};

export const AdministratorCapacityView: Story = {
	decorators: adminStoryDecorators({ isOwner: false }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText('Schedule initialization')).toBeVisible();
		await expect(canvas.getByText(/Only a project owner can generate/)).toBeVisible();
	},
};
