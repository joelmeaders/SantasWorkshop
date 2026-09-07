import { AsyncPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import {
	moduleMetadata,
	type Meta,
	type StoryObj,
} from '@storybook/angular-vite';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	demoSlots,
	getAdminStoryComponent,
	getAdminStoryFixtures,
} from '../../../../../../.storybook/admin/admin-story.providers';
import type { DateTimeSlot } from '@santashop/models';
import { DateTimeModalComponent } from './date-time-modal.component';

const replacementSlot: DateTimeSlot = {
	...demoSlots[0],
	id: 'slot-replacement',
	dateTime: new Date('2026-12-12T19:00:00.000Z'),
	maxSlots: 40,
	slotsReserved: 39,
};

@Component({
	selector: 'admin-storybook-date-time-modal-host',
	standalone: true,
	imports: [AsyncPipe, DateTimeModalComponent],
	template: `
		<admin-date-time-modal
			[slots$]="(slotStream$ | async) ?? emptySlots$"
			[currentSlot]="currentSlot"
		/>
	`,
})
class DateTimeModalStoryComponent {
	@Input() public currentSlot?: DateTimeSlot;

	public readonly initialSlots$ = new BehaviorSubject<DateTimeSlot[]>([
		...demoSlots,
	]);
	public readonly replacementSlots$ = new BehaviorSubject<DateTimeSlot[]>([
		replacementSlot,
	]);
	public readonly slotStream$ = new BehaviorSubject<
		Observable<DateTimeSlot[]>
	>(this.initialSlots$.asObservable());
	public readonly emptySlots$: Observable<DateTimeSlot[]> = of([]);

	public showReplacementSlots(): void {
		this.slotStream$.next(this.replacementSlots$.asObservable());
	}
}

const meta = {
	title: 'Admin/Shared/Date and Time Picker',
	component: DateTimeModalComponent,
	decorators: [
		...adminStoryDecorators(),
		moduleMetadata({ imports: [DateTimeModalStoryComponent] }),
	],
	args: { slots$: of(demoSlots), currentSlot: demoSlots[0] },
	parameters: {
		docs: {
			description: {
				component:
					'Appointment picker grouped by event day. It shows remaining capacity and the family current appointment.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Current Date/Time')).toBeVisible();
		await expect(canvas.getByText('13 spots')).toBeVisible();
		await userEvent.click(canvas.getByText('Cancel'));
	},
} satisfies Meta<DateTimeModalComponent>;

export default meta;
type Story = StoryObj<DateTimeModalComponent>;

export const ChangeAppointment: Story = {};

export const ChooseFirstAppointment: Story = {
	args: { currentSlot: undefined },
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByText('Current Date/Time')).toBeNull();
		await expect(canvas.getByText('Available Dates/Times')).toBeVisible();
	},
};

export const BoundInputUpdatesAndEmitsSelection: Story = {
	args: { currentSlot: undefined },
	render: (args) => ({
		template:
			'<admin-storybook-date-time-modal-host [currentSlot]="currentSlot" />',
		props: args,
	}),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const host = getAdminStoryComponent<DateTimeModalStoryComponent>(
			canvasElement,
			'admin-storybook-date-time-modal-host',
		);
		await expect(canvas.getByText('13 spots')).toBeVisible();

		host.showReplacementSlots();
		await expect(await canvas.findByText('1 spot')).toBeVisible();
		await waitFor(() =>
			expect(canvas.queryByText('13 spots')).not.toBeInTheDocument(),
		);

		await userEvent.click(canvas.getByText('1 spot'));
		const fixtures = getAdminStoryFixtures(canvasElement);
		await waitFor(() =>
			expect(fixtures.modalDismissed.at(-1)).toMatchObject({
				id: replacementSlot.id,
			}),
		);
	},
};
