import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	demoChildren,
	getAdminStoryComponent,
} from '../../../../../../.storybook/admin/admin-story.providers';
import { RegistrationPage } from './registration.page';

const meta = {
	title: 'Admin/Registration/On-Site Registration',
	component: RegistrationPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'On-site family registration form with guardian, referral, child, and newsletter fields before immediate check-in.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const component = getAdminStoryComponent<RegistrationPage>(
			canvasElement,
			'admin-registration',
		);
		await expect(canvas.getByText('Parent / Guardian')).toBeVisible();
		await expect(
			canvas.getByText('Add all children 11 years old or younger'),
		).toBeVisible();
		await component.addChild(demoChildren[0]);
		await expect(await canvas.findByText('Ava Rivera')).toBeVisible();
		await component.removeChild(demoChildren[0].id);
		await waitFor(() =>
			expect(canvas.queryByText('Ava Rivera')).not.toBeInTheDocument(),
		);
		await userEvent.click(canvas.getByText('Pick Agency'));
		await expect(
			canvas.getByText('Yes, continue').closest('ion-item'),
		).toHaveAttribute('disabled');
	},
} satisfies Meta<typeof RegistrationPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyRegistration: Story = {};
