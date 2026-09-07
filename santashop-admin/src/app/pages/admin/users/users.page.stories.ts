import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	getAdminStoryFixtures,
} from '../../../../../../.storybook/admin/admin-story.providers';
import { UsersPage } from './users.page';

const meta = {
	title: 'Admin/Users/User Management',
	component: UsersPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Staff-account roster with role badges and owner-aware edit, password-reset, and delete actions.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Morgan Admin')).toBeVisible();
		await expect(canvas.getByText('Casey Check-In')).toBeVisible();
		const fixtures = getAdminStoryFixtures(canvasElement);
		const loadedAccounts = fixtures.staffAccounts$.value;
		fixtures.staffAccounts$.next([loadedAccounts[0]]);
		await waitFor(() =>
			expect(
				canvas.queryByText('Casey Check-In'),
			).not.toBeInTheDocument(),
		);
		fixtures.staffAccounts$.next(loadedAccounts);
		await expect(await canvas.findByText('Casey Check-In')).toBeVisible();
		await userEvent.click(canvas.getByText('Refresh users'));
		await userEvent.click(canvas.getByTitle('Add user'));
	},
} satisfies Meta<UsersPage>;

export default meta;
type Story = StoryObj<UsersPage>;

export const OwnerView: Story = {};

export const AdministratorView: Story = {
	decorators: adminStoryDecorators({ isOwner: false }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const editButtons = canvas.getAllByTitle('Edit user');
		await expect((editButtons[0] as HTMLIonButtonElement).disabled).toBe(
			true,
		);
		await expect(editButtons).toHaveLength(2);
	},
};
