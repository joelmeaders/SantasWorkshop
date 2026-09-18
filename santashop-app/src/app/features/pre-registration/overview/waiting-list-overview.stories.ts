import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	getIonButton,
	storyRegistration,
} from '../../../../../../.storybook/registration/customer-story.helpers';
import {
	waitingStoryDecorators,
	waitingMember,
} from '../../../../../../.storybook/registration/waiting-list-story.helpers';
import { OverviewPage } from './overview.page';

const meta = {
	title: 'Registration/Waiting List/Overview',
	component: OverviewPage,
	parameters: { layout: 'fullscreen' },
} satisfies Meta<OverviewPage>;
export default meta;
type Story = StoryObj<OverviewPage>;
const join: NonNullable<Story['play']> = async ({
	canvasElement,
}): Promise<void> => {
	const canvas = within(canvasElement);
	const button = getIonButton(canvasElement, /^\s*Join the waiting list/i);
	await expect(button.disabled).toBe(true);
	await userEvent.click(
		canvas.getByRole('checkbox', { name: /Yes, email me/ }),
	);
	await waitFor(() => expect(button.disabled).toBe(false));
	await waitFor(() =>
		expect(getComputedStyle(button).pointerEvents).not.toBe('none'),
	);
	await userEvent.click(button);
};
export const Eligible: Story = { decorators: waitingStoryDecorators() };
export const Joined: Story = {
	decorators: waitingStoryDecorators({ registration: waitingMember }),
};
export const LeaveWhenScheduleIsUnavailable: Story = {
	decorators: waitingStoryDecorators({ registration: waitingMember, scheduleState: 'error' }),
	play: async ({ canvasElement }): Promise<void> => {
		await userEvent.click(getIonButton(canvasElement, /Leave the waiting list/));
		await expect(await within(canvasElement).findByText('You left the waiting list.')).toBeVisible();
	},
};
export const Joining: Story = {
	decorators: waitingStoryDecorators({ saveResult: 'pending' }),
	play: join,
};
export const Leaving: Story = {
	decorators: waitingStoryDecorators({
		registration: waitingMember,
		saveResult: 'pending',
	}),
	play: async ({ canvasElement }): Promise<void> => {
		await userEvent.click(
			getIonButton(canvasElement, /Leave the waiting list/),
		);
	},
};
export const JoinAndLeave: Story = {
	decorators: waitingStoryDecorators(),
	play: async (context): Promise<void> => {
		await join(context);
		const canvas = within(context.canvasElement);
		await expect(
			await canvas.findByText('You joined the waiting list.'),
		).toBeVisible();
		await userEvent.click(
			getIonButton(context.canvasElement, /Leave the waiting list/),
		);
		await expect(
			await canvas.findByText('You left the waiting list.'),
		).toBeVisible();
	},
};
export const ErrorAndRetry: Story = {
	decorators: waitingStoryDecorators({ saveResult: 'error' }),
	play: async (context): Promise<void> => {
		await join(context);
		await expect(
			await within(context.canvasElement).findByRole('alert'),
		).toHaveTextContent('Please try again');
		await userEvent.click(
			getIonButton(context.canvasElement, /Join the waiting list/),
		);
		await expect(
			await within(context.canvasElement).findByText(
				'You joined the waiting list.',
			),
		).toBeVisible();
	},
};
export const Loading: Story = {
	decorators: waitingStoryDecorators({ scheduleState: 'loading' }),
};
export const UnavailableData: Story = {
	decorators: waitingStoryDecorators({ scheduleState: 'error' }),
};
export const CapacityAvailable: Story = {
	decorators: waitingStoryDecorators({
		slots: [
			{
				id: 'future',
				programYear: 2026,
				dateTime: new Date('2099-12-01T18:00:00Z'),
				enabled: true,
				maxSlots: 10,
				slotsReserved: 0,
			},
		],
	}),
};
export const AppointmentSelected: Story = {
	decorators: waitingStoryDecorators({
		registration: { ...storyRegistration, registrationSubmittedOn: undefined },
	}),
};
export const RegistrationComplete: Story = {
	decorators: waitingStoryDecorators({ registration: storyRegistration }),
};
export const FlagDisabled: Story = {
	decorators: waitingStoryDecorators({
		waitingListSettings: { joiningEnabled: false, emailSendingEnabled: false },
	}),
};
export const LeaveWithFlagDisabled: Story = {
	decorators: waitingStoryDecorators({
		registration: waitingMember,
		waitingListSettings: { joiningEnabled: false, emailSendingEnabled: false },
	}),
};
export const Spanish: Story = {
	decorators: waitingStoryDecorators({ language: 'es' }),
};
