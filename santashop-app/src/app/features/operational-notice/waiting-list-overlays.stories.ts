import type { Meta, StoryObj } from '@storybook/angular-vite';
import { getDebugNode, type DebugElement } from '@angular/core';
import { expect, userEvent, within } from 'storybook/test';
import { getIonButton } from '../../../../../.storybook/registration/customer-story.helpers';
import {
	waitingStoryDecorators,
	type WaitingStoryOptions,
} from '../../../../../.storybook/registration/waiting-list-story.helpers';
import {
	OperationalNoticeComponent,
	type OperationalNoticeMode,
} from './operational-notice.component';
const meta = {
	title: 'Registration/Waiting List/Closure Overlays',
	component: OperationalNoticeComponent,
	parameters: { layout: 'fullscreen' },
} satisfies Meta<OperationalNoticeComponent>;
export default meta;
type Story = StoryObj<OperationalNoticeComponent>;
const fixture = (
	mode: OperationalNoticeMode,
	options: WaitingStoryOptions = {},
): Story => ({ args: { mode }, decorators: waitingStoryDecorators(options) });
const signIn: NonNullable<Story['play']> = async ({
	canvasElement,
}): Promise<void> => {
	await userEvent.click(getIonButton(canvasElement, /Sign in/i));
	const element = canvasElement.querySelector('app-operational-notice');
	const component = (getDebugNode(element!) as DebugElement)
		.componentInstance as OperationalNoticeComponent;
	component.signInForm.setValue({
		emailAddress: 'jordan@example.com',
		password: 'StoryOnly123!',
	});
	await component.signIn();
};
const signInPending: NonNullable<Story['play']> = async ({
	canvasElement,
}): Promise<void> => {
	await userEvent.click(getIonButton(canvasElement, /Sign in/i));
	const component = (
		getDebugNode(
			canvasElement.querySelector('app-operational-notice')!,
		) as DebugElement
	).componentInstance as OperationalNoticeComponent;
	component.signInForm.setValue({
		emailAddress: 'jordan@example.com',
		password: 'StoryOnly123!',
	});
	void component.signIn();
};
export const MaintenanceSignedOut: Story = fixture('maintenance', {
	currentUser: null,
	signInResult: 'success',
});
export const MaintenanceEligible: Story = fixture('maintenance', {});
export const MaintenanceJoined: Story = fixture('maintenance', {
	state: { active: true, canJoin: false, reason: 'joined' },
});
export const MaintenanceIneligible: Story = fixture('maintenance', {
	state: { active: false, canJoin: false, reason: 'appointment-selected' },
});
export const MaintenanceUnavailableData: Story = fixture('maintenance', {
	readResult: 'error',
});
export const MaintenanceLoading: Story = fixture('maintenance', {
	readResult: 'pending',
});
export const MaintenanceFlagDisabled: Story = fixture('maintenance', {
	currentUser: null,
	waitingListSettings: { joiningEnabled: false, emailSendingEnabled: false },
});
export const MaintenanceSpanish: Story = fixture('maintenance', {
	language: 'es',
});
export const MaintenanceSignIn: Story = {
	...fixture('maintenance', { currentUser: null, signInResult: 'success' }),
	play: async (context): Promise<void> => {
		await signIn(context);
		await expect(
			await within(context.canvasElement).findByText(
				'All appointment times are full right now. Join the waiting list for an email when more spots open.',
			),
		).toBeVisible();
	},
};
export const MaintenanceSignInError: Story = {
	...fixture('maintenance', { currentUser: null, signInResult: 'error' }),
	play: signIn,
};
export const MaintenanceSignInPending: Story = {
	...fixture('maintenance', { currentUser: null, signInResult: 'pending' }),
	play: signInPending,
};
export const MaintenancePasswordReset: Story = {
	...fixture('maintenance', { currentUser: null }),
	play: async ({ canvasElement }): Promise<void> => {
		await userEvent.click(getIonButton(canvasElement, /Sign in/i));
		const component = (
			getDebugNode(
				canvasElement.querySelector('app-operational-notice')!,
			) as DebugElement
		).componentInstance as OperationalNoticeComponent;
		component.signInForm.controls.emailAddress.setValue('jordan@example.com');
		await component.resetPassword();
	},
};
export const WeatherSignedOut: Story = fixture('weather', {
	currentUser: null,
	signInResult: 'success',
});
export const WeatherEligible: Story = fixture('weather', {});
export const WeatherJoined: Story = fixture('weather', {
	state: { active: true, canJoin: false, reason: 'joined' },
});
export const WeatherIneligible: Story = fixture('weather', {
	state: { active: false, canJoin: false, reason: 'appointment-selected' },
});
export const WeatherUnavailableData: Story = fixture('weather', {
	readResult: 'error',
});
export const WeatherLoading: Story = fixture('weather', {
	readResult: 'pending',
});
export const WeatherFlagDisabled: Story = fixture('weather', {
	currentUser: null,
	waitingListSettings: { joiningEnabled: false, emailSendingEnabled: false },
});
export const WeatherSpanish: Story = fixture('weather', { language: 'es' });
export const WeatherSignIn: Story = {
	...fixture('weather', { currentUser: null, signInResult: 'success' }),
	play: async (context): Promise<void> => {
		await signIn(context);
		await expect(
			await within(context.canvasElement).findByText(
				'All appointment times are full right now. Join the waiting list for an email when more spots open.',
			),
		).toBeVisible();
	},
};
export const WeatherSignInError: Story = {
	...fixture('weather', { currentUser: null, signInResult: 'error' }),
	play: signIn,
};
export const WeatherSignInPending: Story = {
	...fixture('weather', { currentUser: null, signInResult: 'pending' }),
	play: signInPending,
};
export const WeatherPasswordReset: Story = {
	...fixture('weather', { currentUser: null }),
	play: async ({ canvasElement }): Promise<void> => {
		await userEvent.click(getIonButton(canvasElement, /Sign in/i));
		const component = (
			getDebugNode(
				canvasElement.querySelector('app-operational-notice')!,
			) as DebugElement
		).componentInstance as OperationalNoticeComponent;
		component.signInForm.controls.emailAddress.setValue('jordan@example.com');
		await component.resetPassword();
	},
};
export const RegistrationClosedSignedOut: Story = fixture(
	'registration-closed',
	{ currentUser: null, signInResult: 'success' },
);
export const RegistrationClosedEligible: Story = fixture(
	'registration-closed',
	{},
);
export const RegistrationClosedJoined: Story = fixture('registration-closed', {
	state: { active: true, canJoin: false, reason: 'joined' },
});
export const RegistrationClosedIneligible: Story = fixture(
	'registration-closed',
	{ state: { active: false, canJoin: false, reason: 'appointment-selected' } },
);
export const RegistrationClosedUnavailableData: Story = fixture(
	'registration-closed',
	{ readResult: 'error' },
);
export const RegistrationClosedLoading: Story = fixture('registration-closed', {
	readResult: 'pending',
});
export const RegistrationClosedFlagDisabled: Story = fixture(
	'registration-closed',
	{
		currentUser: null,
		waitingListSettings: { joiningEnabled: false, emailSendingEnabled: false },
	},
);
export const RegistrationClosedSpanish: Story = fixture('registration-closed', {
	language: 'es',
});
export const RegistrationClosedSignIn: Story = {
	...fixture('registration-closed', {
		currentUser: null,
		signInResult: 'success',
	}),
	play: async (context): Promise<void> => {
		await signIn(context);
		await expect(
			await within(context.canvasElement).findByText(
				'All appointment times are full right now. Join the waiting list for an email when more spots open.',
			),
		).toBeVisible();
	},
};
export const RegistrationClosedSignInError: Story = {
	...fixture('registration-closed', {
		currentUser: null,
		signInResult: 'error',
	}),
	play: signIn,
};
export const RegistrationClosedSignInPending: Story = {
	...fixture('registration-closed', {
		currentUser: null,
		signInResult: 'pending',
	}),
	play: signInPending,
};
export const RegistrationClosedPasswordReset: Story = {
	...fixture('registration-closed', { currentUser: null }),
	play: async ({ canvasElement }): Promise<void> => {
		await userEvent.click(getIonButton(canvasElement, /Sign in/i));
		const component = (
			getDebugNode(
				canvasElement.querySelector('app-operational-notice')!,
			) as DebugElement
		).componentInstance as OperationalNoticeComponent;
		component.signInForm.controls.emailAddress.setValue('jordan@example.com');
		await component.resetPassword();
	},
};
