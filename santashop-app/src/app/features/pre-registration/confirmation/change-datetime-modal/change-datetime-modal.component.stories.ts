import {
	moduleMetadata,
	type Meta,
	type StoryObj,
} from '@storybook/angular-vite';
import { Component, getDebugNode, type DebugElement } from '@angular/core';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	customerStoryDecorators,
	getIonButton,
	storySlots,
} from '../../../../../../../.storybook/registration/customer-story.helpers';
import { BehaviorSubject } from 'rxjs';
import { ChangeDatetimeModalComponent } from './change-datetime-modal.component';

const meta = {
	title: 'Registration/Appointments/Change Appointment Modal',
	component: ChangeDatetimeModalComponent,
	decorators: customerStoryDecorators(),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'The production modal groups live enabled appointments by day and marks the current selection.',
			},
		},
	},
} satisfies Meta<ChangeDatetimeModalComponent>;

export default meta;
type Story = StoryObj<ChangeDatetimeModalComponent>;

@Component({
	selector: 'app-storybook-live-appointments',
	imports: [ChangeDatetimeModalComponent],
	template:
		'<app-change-datetime-modal [currentSlot]="currentSlot" [availableSlots]="availability" />',
})
class LiveAppointmentsStoryComponent {
	public readonly currentSlot = storySlots[0];
	public readonly availability = new BehaviorSubject([...storySlots]);
}

export const AvailableAppointments: Story = {
	decorators: [moduleMetadata({ imports: [LiveAppointmentsStoryComponent] })],
	render: () => ({ template: '<app-storybook-live-appointments />' }),
	play: async ({ canvasElement }) => {
		const element = canvasElement.querySelector(
			'app-storybook-live-appointments',
		);
		if (!element) throw new Error('Live appointment host was not rendered');
		const host = (getDebugNode(element) as DebugElement)
			.componentInstance as LiveAppointmentsStoryComponent;
		expect(
			canvasElement.querySelector('[data-change-slot-id="sat-morning"]'),
		).toBeInTheDocument();

		const replacement = {
			...storySlots[0],
			id: 'replacement-slot',
			dateTime: new Date('2026-12-07T16:00:00.000Z'),
		};
		host.availability.next([replacement]);
		await waitFor(() =>
			expect(
				canvasElement.querySelector(
					'[data-change-slot-id="replacement-slot"]',
				),
			).toBeInTheDocument(),
		);
		expect(
			canvasElement.querySelector('[data-change-slot-id="sat-morning"]'),
		).toBeNull();

		host.availability.next([]);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-change-slot-id]'),
			).toBeNull(),
		);
		host.availability.next([...storySlots]);
		await waitFor(() =>
			expect(
				canvasElement.querySelector(
					'[data-change-slot-id="sat-morning"]',
				),
			).toBeInTheDocument(),
		);
		const canvas = within(canvasElement);
		expect(canvas.getByText(/change date.*time/i)).toBeVisible();
		const cancel = getIonButton(canvasElement, /cancel/i);
		await userEvent.click(cancel);
		expect(cancel).toBeEnabled();
	},
};
