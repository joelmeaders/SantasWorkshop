import {
	applicationConfig,
	type Meta,
	type StoryObj,
} from '@storybook/angular-vite';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type {
	PublishWaitingListSettingsRequest,
	WaitingListSettingsResponse,
} from '@santashop/models';
import { provideAdminLanguage } from '../../../../shared/preferences/admin-language.providers';
import { AppSettingsService } from '../../../../shared/services/app-settings.service';
import { WaitingListSettingsComponent } from './waiting-list-settings.component';

const meta = {
	title: 'Admin/Waiting List/Settings',
	component: WaitingListSettingsComponent,
} satisfies Meta<WaitingListSettingsComponent>;
export default meta;
type Story = StoryObj<WaitingListSettingsComponent>;
const fixture = (
	joiningEnabled = false,
	emailSendingEnabled = false,
	state = '',
): Story => ({
	decorators: [
		applicationConfig({
			providers: [
				provideRouter([], withHashLocation()),
				provideIonicAngular(),
				provideAdminLanguage(),
				{
					provide: AppSettingsService,
					useFactory: (): object => ({
						readWaitingList: async (): Promise<WaitingListSettingsResponse> => {
							if (state === 'loading') return new Promise(() => undefined);
							if (state === 'load-error') throw new Error('Unavailable');
							return {
								settings: { joiningEnabled, emailSendingEnabled },
								etag: 'waiting-v1',
								version: '1',
							};
						},
						publishWaitingList: async (
							request: PublishWaitingListSettingsRequest,
						): Promise<WaitingListSettingsResponse> => {
							if (state === 'publishing') return new Promise(() => undefined);
							if (state === 'conflict' || state === 'failure')
								throw Object.assign(new Error('Unavailable'), {
									code:
										state === 'conflict'
											? 'functions/aborted'
											: 'functions/unavailable',
								});
							return {
								settings: request.settings,
								etag: 'waiting-v2',
								version: '2',
							};
						},
					}),
				},
			],
		}),
	],
});
const edit: NonNullable<Story['play']> = async ({
	canvasElement,
}): Promise<void> => {
	await userEvent.click(
		await within(canvasElement).findByText(
			'Allow customers to join the waiting list',
		),
	);
};
const publish: NonNullable<Story['play']> = async (context): Promise<void> => {
	await edit(context);
	const button = within(context.canvasElement)
		.getByText('Publish waiting list settings')
		.closest('ion-button')!;
	await waitFor(() =>
		expect(getComputedStyle(button).pointerEvents).not.toBe('none'),
	);
	await userEvent.click(button);
};
export const BothDisabled: Story = fixture();
export const JoiningOnly: Story = fixture(true);
export const SendingOnly: Story = fixture(false, true);
export const BothEnabled: Story = fixture(true, true);
export const Loading: Story = fixture(false, false, 'loading');
export const LoadFailure: Story = fixture(false, false, 'load-error');
export const Edited: Story = { ...fixture(), play: edit };
export const Publishing: Story = {
	...fixture(false, false, 'publishing'),
	play: publish,
};
export const Saved: Story = {
	...fixture(),
	play: async (context): Promise<void> => {
		await publish(context);
		await expect(
			await within(context.canvasElement).findByText(
				'Waiting list settings published.',
			),
		).toBeVisible();
	},
};
export const Conflict: Story = {
	...fixture(false, false, 'conflict'),
	play: publish,
};
export const Failure: Story = {
	...fixture(false, false, 'failure'),
	play: publish,
};
export const SpanishDark: Story = {
	...fixture(true, false),
	parameters: { adminLanguage: 'es', adminTheme: 'dark' },
};
export const EnglishDark: Story = {
	...fixture(true, true),
	parameters: { adminTheme: 'dark' },
};
export const SpanishLight: Story = {
	...fixture(false, true),
	parameters: { adminLanguage: 'es' },
};
