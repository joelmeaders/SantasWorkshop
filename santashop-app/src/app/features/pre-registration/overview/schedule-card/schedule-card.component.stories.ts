import { AsyncPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { moduleMetadata } from '@storybook/angular-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { DateTimeSlot } from '@santashop/models';
import { BehaviorSubject } from 'rxjs';
import {
	customerStoryDecorators,
	storySlots,
} from '../../../../../../../.storybook/registration/customer-story.helpers';
import { ScheduleCardComponent } from './schedule-card.component';

interface ScheduleInputControls {
	readonly slots$: BehaviorSubject<DateTimeSlot[] | undefined>;
	readonly dateTimeSlot$: BehaviorSubject<DateTimeSlot | undefined>;
	readonly canChooseDateTime: boolean;
	readonly busy: boolean;
	readonly collapsed: boolean;
}

@Component({
	selector: 'app-storybook-schedule-card-input-host',
	standalone: true,
	imports: [AsyncPipe, ScheduleCardComponent],
	template: `
		<app-schedule-card
			[dateTimeSlot]="controls().dateTimeSlot$ | async"
			[slots]="controls().slots$ | async"
			[canChooseDateTime]="controls().canChooseDateTime"
			[busy]="controls().busy"
			[collapsed]="controls().collapsed"
			(selectRequested)="selectRequested()($event)"
		/>
	`,
})
class ScheduleCardInputHostComponent {
	public readonly controls = input.required<ScheduleInputControls>();
	public readonly selectRequested = input.required<
		(slot: DateTimeSlot | undefined) => void
	>();
}

let renderedScheduleInputs: ScheduleInputControls | undefined;

function createScheduleInputControls(): ScheduleInputControls {
	return {
		slots$: new BehaviorSubject<DateTimeSlot[] | undefined>(undefined),
		dateTimeSlot$: new BehaviorSubject<DateTimeSlot | undefined>(undefined),
		canChooseDateTime: true,
		busy: false,
		collapsed: false,
	};
}

const meta = {
	title: 'Registration/Workspace/Schedule Card',
	component: ScheduleCardComponent,
	decorators: customerStoryDecorators(),
	args: { selectRequested: fn() },
	parameters: {
		docs: {
			description: {
				component:
					'Appointment availability grouped by Denver event date, with loading, locked, empty, and selected states.',
			},
		},
	},
} satisfies Meta<ScheduleCardComponent>;

export default meta;
type Story = StoryObj<ScheduleCardComponent>;

export const AvailableTimes: Story = {
	args: { canChooseDateTime: true, slots: storySlots },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText(/choose.*date.*time/i)).toBeVisible();
		expect(canvas.getAllByText(/spots?/i)).toHaveLength(3);
		const firstSlot = canvasElement.querySelector(
			'[data-select-slot-id="sat-morning"]',
		) as HTMLElement;
		await userEvent.click(firstSlot);
		expect(args.selectRequested).toHaveBeenCalledWith(storySlots[0]);
	},
};

export const LoadingAvailability: Story = {
	args: { canChooseDateTime: true, slots: undefined },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByRole('status')).toHaveTextContent(/loading/i);
		expect(canvasElement.querySelector('[data-select-slot-id]')).toBeNull();
	},
};

export const InputBindingUpdates: Story = {
	decorators: [
		moduleMetadata({ imports: [ScheduleCardInputHostComponent] }),
	],
	render: (args) => {
		renderedScheduleInputs = createScheduleInputControls();
		return {
			props: {
				...args,
				controls: renderedScheduleInputs,
			},
			template:
				'<app-storybook-schedule-card-input-host [controls]="controls" [selectRequested]="selectRequested" />',
		};
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const controls = renderedScheduleInputs;
		if (!controls) throw new Error('Schedule input controls were not created');

		expect(canvas.getByRole('status')).toHaveTextContent(/loading/i);
		expect(canvasElement.querySelector('[data-select-slot-id]')).toBeNull();

		controls.slots$.next(storySlots);
		await waitFor(() =>
			expect(
				canvasElement.querySelector(
					'[data-select-slot-id="sat-morning"]',
				),
			).toBeInTheDocument(),
		);

		await userEvent.click(
			canvasElement.querySelector(
				'[data-select-slot-id="sat-morning"]',
			) as HTMLElement,
		);
		expect(args.selectRequested).toHaveBeenCalledWith(storySlots[0]);

		controls.slots$.next([]);
		await waitFor(() =>
			expect(canvas.getByText(/all spots have been filled/i)).toBeVisible(),
		);
	},
};

export const ChildRequired: Story = {
	args: { canChooseDateTime: false, slots: storySlots },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText(/child/i)).toBeVisible();
		expect(canvasElement.querySelector('.schedule-card')).toHaveClass(
			'is-locked',
		);
	},
};
