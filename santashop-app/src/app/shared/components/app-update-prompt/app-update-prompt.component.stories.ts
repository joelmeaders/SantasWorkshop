import { signal } from '@angular/core';
import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { applicationConfig } from '@storybook/angular-vite';
import { expect, fn, within } from 'storybook/test';
import {
	AppUpdatePromptComponent,
	AppUpdateService,
	type AppUpdateNotice,
} from '@santashop/core/customer';
import spanish from '../../../../assets/i18n/es.json';

interface StoryUpdateService {
	notice: ReturnType<typeof signal<AppUpdateNotice>>;
	dismiss: ReturnType<typeof fn>;
	reload: ReturnType<typeof fn>;
}

const createStoryUpdateService = (
	initialNotice: Exclude<AppUpdateNotice, null>,
): StoryUpdateService => ({
	notice: signal<AppUpdateNotice>(initialNotice),
	dismiss: fn(),
	reload: fn(),
});

const meta = {
	title: 'Registration/Controls/App Update Prompt',
	component: AppUpdatePromptComponent,
	parameters: {
		docs: {
			description: {
				component:
					'Accessible service-worker update notices let customers reload when a new version is ready or when the current version cannot continue safely.',
			},
		},
	},
	decorators: [
		applicationConfig({
			providers: [
				{
					provide: AppUpdateService,
					useValue: createStoryUpdateService('ready'),
				},
			],
		}),
	],
} satisfies Meta<AppUpdatePromptComponent>;

export default meta;
type Story = StoryObj<AppUpdatePromptComponent>;

export const UpdateReady: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const prompt = canvas.getByRole('status');

		expect(prompt).toHaveTextContent(/information you have not saved/i);
		expect(
			canvas.getByRole('button', { name: /refresh page/i }),
		).toBeVisible();
		expect(canvas.getByRole('button', { name: /not now/i })).toBeVisible();
	},
};

export const ReloadRequired: Story = {
	decorators: [
		applicationConfig({
			providers: [
				{
					provide: AppUpdateService,
					useValue: createStoryUpdateService('unrecoverable'),
				},
			],
		}),
	],
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		expect(canvas.getByRole('status')).toHaveTextContent(
			/please refresh to continue/i,
		);
		expect(canvas.getAllByRole('button')).toHaveLength(1);
	},
};

export const UpdateReadySpanish: Story = {
	args: {
		copy: {
			readyTitle: spanish.APP_UPDATE.READY_TITLE,
			readyMessage: spanish.APP_UPDATE.READY_MESSAGE,
			failedTitle: spanish.APP_UPDATE.FAILED_TITLE,
			failedMessage: spanish.APP_UPDATE.FAILED_MESSAGE,
			unrecoverableTitle: spanish.APP_UPDATE.UNRECOVERABLE_TITLE,
			unrecoverableMessage: spanish.APP_UPDATE.UNRECOVERABLE_MESSAGE,
			reloadLabel: spanish.APP_UPDATE.RELOAD,
			laterLabel: spanish.APP_UPDATE.LATER,
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByRole('status')).toHaveTextContent(
			spanish.APP_UPDATE.READY_MESSAGE,
		);
		await expect(
			canvas.getByRole('button', { name: spanish.APP_UPDATE.RELOAD }),
		).toBeVisible();
		await expect(
			canvas.getByRole('button', { name: spanish.APP_UPDATE.LATER }),
		).toBeVisible();
	},
};
