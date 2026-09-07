import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	adminStoryDecorators,
	demoStaffAccounts,
} from '../../../../../../.storybook/admin/admin-story.providers';
import { UserEditorComponent } from './user-editor.component';

const meta = {
	title: 'Admin/Users/User Editor',
	component: UserEditorComponent,
	decorators: adminStoryDecorators(),
	args: { isOwner: true },
	parameters: {
		docs: {
			description: {
				component:
					'Create or edit an elevated staff account. Owners can grant administrator access. Administrators can grant check-in access.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('New User')).toBeVisible();
		await expect(canvas.getByText('Create user').closest('ion-button')).toHaveAttribute(
			'disabled',
		);
		await userEvent.click(canvas.getByText('Cancel'));
	},
} satisfies Meta<UserEditorComponent>;

export default meta;
type Story = StoryObj<UserEditorComponent>;

export const NewStaffUser: Story = {};

export const EditAdministrator: Story = {
	args: { account: demoStaffAccounts[0] },
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Edit User')).toBeVisible();
		await expect(
			canvas.getByText('Email addresses cannot be changed after creation.'),
		).toBeVisible();
		await expect(canvas.getByText('Save changes').closest('ion-button')).not.toHaveAttribute(
			'disabled',
		);
	},
};
