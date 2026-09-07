import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../.storybook/admin/admin-story.providers';
import { PreRegistrationPage } from './pre-registration.page';

const meta = {
	title: 'Admin/Registration/Pre-Registration',
	component: PreRegistrationPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Full staff pre-registration workflow with language, guardian, referral, children, and an available appointment.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Reservation')).toBeVisible();
		await expect(canvas.getByText('Add all children 11 years old or younger')).toBeVisible();
		await userEvent.click(canvas.getByText('Pick Agency'));
		await expect(canvas.getByText('Pick a date and time')).toBeVisible();
	},
} satisfies Meta<typeof PreRegistrationPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyRegistration: Story = {};
