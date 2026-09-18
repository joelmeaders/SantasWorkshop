import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { DateTimeSlot } from '@santashop/models';
import {
	adminStoryDecorators,
	getAdminStoryComponent,
	getAdminStoryFixtures,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { ScheduleEditorPage } from './schedule-editor.page';

const slots: DateTimeSlot[] = [
	{
		id: 'past-october',
		programYear: 2026,
		dateTime: new Date('2026-10-01T16:00:00Z'),
		enabled: false,
		maxSlots: 20,
		slotsReserved: 10,
	},
	{
		id: 'current-november',
		programYear: 2026,
		dateTime: new Date('2026-11-12T16:00:00Z'),
		enabled: true,
		maxSlots: 20,
		slotsReserved: 20,
	},
	{
		id: 'future-december',
		programYear: 2026,
		dateTime: new Date('2026-12-12T16:00:00Z'),
		enabled: false,
		maxSlots: 20,
		slotsReserved: 0,
	},
];
const meta = {
	title: 'Admin/Waiting List/Year Round Slot Controls',
	component: ScheduleEditorPage,
	decorators: adminStoryDecorators({ slots, persistSlotChanges: true }),
	parameters: {
		docs: {
			description: {
				component:
					'Operators can open and close slots in any month, including past dates. Customers can only choose future appointments.',
			},
		},
	},
} satisfies Meta<ScheduleEditorPage>;
export default meta;
type Story = StoryObj<ScheduleEditorPage>;
export const OctoberNovemberDecember: Story = {};
export const IndividualOpenAndClose: Story = {
	play: async ({ canvasElement }): Promise<void> => {
		const toggle = canvasElement.querySelector(
			'#slotEnabled-past-october',
		) as HTMLIonToggleElement;
		await expect(toggle.disabled).toBe(false);
		await userEvent.click(toggle);
		const fixtures = getAdminStoryFixtures(canvasElement);
		await waitFor(() =>
			expect(
				fixtures.slots$.value.find((slot) => slot.id === 'past-october')
					?.enabled,
			).toBe(true),
		);
		await userEvent.click(toggle);
		await waitFor(() =>
			expect(
				fixtures.slots$.value.find((slot) => slot.id === 'past-october')
					?.enabled,
			).toBe(false),
		);
		await waitFor(() => expect(toggle.disabled).toBe(false));
		await waitFor(() =>
			expect(
				getComputedStyle(
					canvasElement.querySelector('#scheduleRow-past-october')!,
				).opacity,
			).toBe('1'),
		);
	},
};
export const BulkOpen: Story = {
	play: async ({ canvasElement }): Promise<void> => {
		await userEvent.click(within(canvasElement).getByText('Select all'));
		const component = getAdminStoryComponent<ScheduleEditorPage>(
			canvasElement,
			'admin-schedule-editor',
		);
		component.bulkEditForm.controls['enabled'].setValue('enabled');
		const button = canvasElement.querySelector('#applyBulkEditButton')!;
		await waitFor(() =>
			expect(getComputedStyle(button).pointerEvents).not.toBe('none'),
		);
		await userEvent.click(button);
		await waitFor(() =>
			expect(
				getAdminStoryFixtures(canvasElement).slots$.value.every(
					(slot) => slot.enabled,
				),
			).toBe(true),
		);
	},
};
export const BulkClose: Story = {
	play: async ({ canvasElement }): Promise<void> => {
		await userEvent.click(within(canvasElement).getByText('Select all'));
		const component = getAdminStoryComponent<ScheduleEditorPage>(
			canvasElement,
			'admin-schedule-editor',
		);
		component.bulkEditForm.controls['enabled'].setValue('disabled');
		const button = canvasElement.querySelector('#applyBulkEditButton')!;
		await waitFor(() =>
			expect(getComputedStyle(button).pointerEvents).not.toBe('none'),
		);
		await userEvent.click(button);
		await waitFor(() =>
			expect(
				getAdminStoryFixtures(canvasElement).slots$.value.every(
					(slot) => !slot.enabled,
				),
			).toBe(true),
		);
	},
};
export const SpanishLight: Story = { parameters: { adminLanguage: 'es' } };
export const SpanishDark: Story = {
	parameters: { adminLanguage: 'es', adminTheme: 'dark' },
};
export const EnglishDark: Story = { parameters: { adminTheme: 'dark' } };
