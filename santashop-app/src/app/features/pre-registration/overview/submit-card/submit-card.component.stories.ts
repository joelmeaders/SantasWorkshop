import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
	customerStoryDecorators,
	getIonButton,
	storyChildren,
	storySlots,
} from '../../../../../../../.storybook/registration/customer-story.helpers';
import { SubmitCardComponent } from './submit-card.component';

const meta = {
	title: 'Registration/Workspace/Submit Card',
	component: SubmitCardComponent,
	decorators: customerStoryDecorators(),
	args: {
		submitRequested: fn(),
		emailUpdateRequested: fn(),
		reviewRequested: fn(),
		changesRequested: fn(),
	},
	parameters: {
		docs: {
			description: {
				component:
					'The final review card confirms children, appointment, and delivery email before submission.',
			},
		},
	},
} satisfies Meta<SubmitCardComponent>;

export default meta;
type Story = StoryObj<SubmitCardComponent>;

export const ReadyForReview: Story = {
	args: {
		children: storyChildren,
		dateTimeSlot: storySlots[0],
		emailAddress: 'jordan.garcia@example.com',
		canSubmit: true,
	},
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		const review = getIonButton(canvasElement, /review registration/i);
		await userEvent.click(review);
		expect(args.reviewRequested).toHaveBeenCalledOnce();
		await waitFor(() =>
			expect(canvas.getByText('Maya Garcia')).toBeVisible(),
		);
		expect(canvas.getByText('jordan.garcia@example.com')).toBeVisible();
		await userEvent.click(getIonButton(canvasElement, /^\s*submit\s*$/i));
		expect(args.submitRequested).toHaveBeenCalledOnce();
	},
};

export const IncompleteRegistration: Story = {
	args: {
		children: storyChildren,
		canSubmit: false,
		emailAddress: 'jordan.garcia@example.com',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText(/add a valid child/i)).toBeVisible();
		expect(
			canvasElement.querySelector('#completeRegistrationButton'),
		).toBeNull();
	},
};
