import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { ShopperAccessPanelComponent } from './shopper-access-panel.component';
import { shopperAccessStoryFixtures } from './shopper-access.story-fixtures';

const meta = {
	title: 'Admin/Check-In/Shopper Access',
	component: ShopperAccessPanelComponent,
	decorators: adminStoryDecorators(),
	args: {
		uid: 'demo-shopper',
		emailAddress: 'shopper@example.test',
		canManageAccess: true,
	},
} satisfies Meta<ShopperAccessPanelComponent>;

export default meta;
type Story = StoryObj<ShopperAccessPanelComponent>;

export const Enabled: Story = {
	decorators: [shopperAccessStoryFixtures('enabled')],
	play: async ({ canvasElement }): Promise<void> => {
		await expect(
			await within(canvasElement).findByText('Access is enabled'),
		).toBeVisible();
	},
};

export const DisableReasonDialog: Story = {
	decorators: [shopperAccessStoryFixtures('enabled')],
};

export const DisableReasonInteraction: Story = {
	...DisableReasonDialog,
	tags: ['!dev', '!autodocs'],
	play: async ({ canvasElement }): Promise<void> => {
		await userEvent.click(
			await within(canvasElement).findByText('Disable access'),
		);
		const alert = await within(canvasElement.ownerDocument.body).findByRole(
			'alertdialog',
		);
		const dialog = within(alert);
		await expect(dialog.getByText('Disable shopper access?')).toBeVisible();
		await expect(
			dialog
				.getAllByRole('radio')
				.map((reason) => reason.textContent?.trim()),
		).toEqual([
			'Duplicate registration',
			'Suspected automated signup',
			'Registration information couldn’t be verified',
		]);
		await userEvent.click(
			dialog.getByRole('button', { name: 'Disable access' }),
		);
		await expect(alert).toBeVisible();
		await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
		await waitFor(() => expect(alert).not.toBeInTheDocument());
	},
};

export const Disabled: Story = {
	decorators: [shopperAccessStoryFixtures('disabled')],
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('Access is disabled'),
		).toBeVisible();
		await expect(canvas.getByText('Duplicate registration')).toBeVisible();
	},
};

export const ReEnableDialog: Story = {
	decorators: [shopperAccessStoryFixtures('disabled')],
};

export const ReEnableInteraction: Story = {
	...ReEnableDialog,
	tags: ['!dev', '!autodocs'],
	play: async ({ canvasElement }): Promise<void> => {
		await userEvent.click(
			await within(canvasElement).findByText('Re-enable access'),
		);
		const alert = await within(canvasElement.ownerDocument.body).findByRole(
			'alertdialog',
		);
		await expect(
			within(alert).getByText(
				'This restores access only. It does not restore a canceled registration.',
			),
		).toBeVisible();
		await userEvent.click(
			within(alert).getByRole('button', { name: 'Cancel' }),
		);
		await waitFor(() => expect(alert).not.toBeInTheDocument());
	},
};

export const ReviewedAndCleared: Story = {
	decorators: [shopperAccessStoryFixtures('reviewed-and-cleared')],
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('Access is enabled'),
		).toBeVisible();
		await expect(canvas.getByText('Reviewed and cleared')).toBeVisible();
	},
};
