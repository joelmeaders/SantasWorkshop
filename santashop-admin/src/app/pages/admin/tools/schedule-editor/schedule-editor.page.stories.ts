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
		await expect(
			await canvas.findByText('Generate hourly schedules'),
		).toBeVisible();
		await expect(canvas.getByText('At capacity')).toBeVisible();
		await userEvent.click(canvas.getByText('Select all'));
		await expect(canvas.getAllByText('2 selected').length).toBeGreaterThan(
			0,
		);
		const applyButton = canvas
			.getByText('Apply to 2 selected')
			.closest('ion-button');
		await expect((applyButton as HTMLIonButtonElement).disabled).toBe(
			false,
		);
	},
} satisfies Meta<ScheduleEditorPage>;

export default meta;
type Story = StoryObj<ScheduleEditorPage>;

export const OwnerCapacityView: Story = {};

export const AdministratorCapacityView: Story = {
	decorators: adminStoryDecorators({ isOwner: false }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('Schedule initialization'),
		).toBeVisible();
		await expect(
			canvas.getByText(/Only a project owner can generate/),
		).toBeVisible();
	},
};

export const ExpandedScheduleControls: Story = {
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const editor = canvasElement.querySelector<HTMLDetailsElement>(
			'details.slot-editor',
		);
		await expect(editor).not.toBeNull();
		await expect(editor?.open).toBe(false);
		await userEvent.click(canvas.getAllByText('Edit schedule')[0]);
		await expect(editor?.open).toBe(true);
		const date = canvasElement.querySelector(
			'#slotDate-slot-2026-12-12-10',
		);
		await expect(date).toBeVisible();
		await expect(
			canvasElement.querySelector('#saveTimeSlot-slot-2026-12-12-10'),
		).toBeVisible();
		await userEvent.click(canvas.getAllByText('Edit schedule')[0]);
		await expect(editor?.open).toBe(false);
		await expect(date).not.toBeVisible();
		await userEvent.click(canvas.getByText('Generate hourly schedules'));
		await expect(
			canvasElement.querySelector('#generateStartDate'),
		).toBeVisible();
	},
};
