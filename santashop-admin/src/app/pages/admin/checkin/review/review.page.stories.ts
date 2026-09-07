import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	demoRegistration,
	getAdminStoryFixtures,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { ReviewPage } from './review.page';

const meta = {
	title: 'Admin/Check-In/Review',
	component: ReviewPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Production review step with guardian details, appointment details, child management, cancellation, and the final check-in control.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText(/Elena Rivera/)).toBeVisible();
		await expect(canvas.getByText('Ava Rivera')).toBeVisible();
		const fixtures = getAdminStoryFixtures(canvasElement);
		fixtures.registration$.next({
			...demoRegistration,
			firstName: 'Jordan',
			lastName: 'Nguyen',
			emailAddress: 'jordan.nguyen@example.test',
		});
		await expect(await canvas.findByText(/Jordan Nguyen/)).toBeVisible();
		await waitFor(() =>
			expect(canvas.queryByText(/Elena Rivera/)).not.toBeInTheDocument(),
		);
		await userEvent.click(canvas.getByText('Add Child'));
		await expect(canvas.getByText('Yes, check in')).toBeVisible();
	},
} satisfies Meta<typeof ReviewPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EligibleFamily: Story = {};

export const CheckInClosed: Story = {
	decorators: adminStoryDecorators({ featureEnabled: false }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText(/Check-In is not available/),
		).toBeVisible();
		const confirmItem = canvas
			.getByText('Yes, check in')
			.closest('ion-item');
		await expect((confirmItem as HTMLIonItemElement).disabled).toBe(true);
	},
};
