import { provideAdminLanguage } from '../../../../shared/preferences/admin-language.providers';
import {
	applicationConfig,
	type Meta,
	type StoryObj,
} from '@storybook/angular-vite';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { createDefaultPublicParameters } from '@santashop/models';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AppSettingsService } from '../../../../shared/services/app-settings.service';
import { AppSettingsPage } from './app-settings.page';

const response = {
	settings: createDefaultPublicParameters(),
	etag: 'story-1',
	version: '42',
};
const meta = {
	title: 'Admin/Tools/App settings',
	component: AppSettingsPage,
	decorators: [
		applicationConfig({
			providers: [
				provideRouter([], withHashLocation()),
				provideIonicAngular(),
				provideAdminLanguage(),
				{
					provide: AppSettingsService,
					useValue: {
						read: async (): Promise<typeof response> =>
							structuredClone(response),
						publish: async (request: {
							settings: typeof response.settings;
						}): Promise<typeof response> => ({
							...response,
							settings: request.settings,
							version: '43',
						}),
					},
				},
			],
		}),
	],
} satisfies Meta<AppSettingsPage>;
export default meta;
type Story = StoryObj<AppSettingsPage>;

export const Loaded: Story = {
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText(/Version 42/)).toBeVisible();
		await expect(
			canvas.getByText('Publish').closest('ion-button'),
		).toHaveAttribute('disabled');
	},
};
export const PublishChange: Story = {
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await canvas.findByText(/Version 42/);
		await userEvent.click(canvas.getByText('Maintenance mode enabled'));
		await waitFor(async () => {
			await expect(
				canvas.getByText('Publish').closest('ion-button'),
			).not.toHaveAttribute('disabled');
		});
		await userEvent.click(canvas.getByText('Publish'));
		await expect(
			await canvas.findByText('Published version 43.'),
		).toBeVisible();
	},
};
export const Conflict: Story = {
	decorators: [
		applicationConfig({
			providers: [
				{
					provide: AppSettingsService,
					useValue: {
						read: async (): Promise<typeof response> =>
							structuredClone(response),
						publish: async (): Promise<never> => {
							throw Object.assign(new Error('Conflict'), {
								code: 'functions/aborted',
							});
						},
					},
				},
			],
		}),
	],
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await canvas.findByText(/Version 42/);
		await userEvent.click(canvas.getByText('Maintenance mode enabled'));
		await waitFor(async () => {
			await expect(
				canvas.getByText('Publish').closest('ion-button'),
			).not.toHaveAttribute('disabled');
		});
		await userEvent.click(canvas.getByText('Publish'));
		await expect(await canvas.findByRole('alert')).toHaveTextContent(
			'Your edits remain here',
		);
		await expect(canvas.getByText(/You have unsaved edits/)).toBeVisible();
	},
};
export const LoadFailure: Story = {
	decorators: [
		applicationConfig({
			providers: [
				{
					provide: AppSettingsService,
					useValue: {
						read: async (): Promise<never> => {
							throw new Error(
								'Settings service is unavailable. Retry shortly.',
							);
						},
					},
				},
			],
		}),
	],
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByRole('alert')).toHaveTextContent(
			'Settings service is unavailable. Retry shortly.',
		);
		await waitFor(async () => {
			await expect(
				canvas.getByText('Reload settings').closest('ion-button'),
			).not.toHaveAttribute('disabled');
		});
		await expect(canvas.queryByText('Publish')).not.toBeInTheDocument();
	},
};
export const Loading: Story = {
	decorators: [
		applicationConfig({
			providers: [
				{
					provide: AppSettingsService,
					useValue: {
						read: (): Promise<never> =>
							new Promise(() => undefined),
					},
				},
			],
		}),
	],
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByLabelText('Loading settings'),
		).toBeVisible();
	},
};
