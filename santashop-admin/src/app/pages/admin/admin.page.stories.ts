import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../.storybook/admin/admin-story.providers';
import { AdminPage } from './admin.page';

const meta = {
	title: 'Admin/Shell/Tab Navigation',
	component: AdminPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'The production admin shell with Home, Check-In, Search, and Registration tabs.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Home')).toBeVisible();
		await expect(canvas.getByText('Check-In')).toBeVisible();
		await expect(canvas.getByText('Search')).toBeVisible();
		await expect(canvas.getByText('Registration')).toBeVisible();
	},
} satisfies Meta<typeof AdminPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllWorkflowsEnabled: Story = {};

export const RegistrationAndCheckInClosed: Story = {
	decorators: adminStoryDecorators({ featureEnabled: false }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Home')).toBeVisible();
		await expect(canvas.getByText('Search')).toBeVisible();
		const checkInTab = canvas.getByText('Check-In').closest('ion-tab-button');
		const registrationTab = canvas.getByText('Registration').closest('ion-tab-button');
		await expect((checkInTab as HTMLIonTabButtonElement).disabled).toBe(true);
		await expect((registrationTab as HTMLIonTabButtonElement).disabled).toBe(true);
	},
};
