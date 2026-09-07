import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	customerStoryDecorators,
	getIonButton,
	storySlots,
} from '../../../../../../../.storybook/registration/customer-story.helpers';
import { of } from 'rxjs';
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

export const AvailableAppointments: Story = {
	args: {
		currentSlot: storySlots[0],
		availableSlots: of(storySlots),
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText(/change date.*time/i)).toBeVisible();
		expect(canvas.getAllByText(/spots?/i).length).toBeGreaterThan(1);
		const cancel = getIonButton(canvasElement, /cancel/i);
		await userEvent.click(cancel);
		expect(cancel).toBeEnabled();
	},
};
