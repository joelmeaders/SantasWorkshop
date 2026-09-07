import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	getAdminStoryFixtures,
} from '../../../../../../.storybook/admin/admin-story.providers';
import { LandingPage } from './landing.page';

const meta = {
	title: 'Admin/Navigation/Landing',
	component: LandingPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Owner view of the admin navigation. Feature flags disable seasonal workflows while data and owner tools stay available.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByText('DSCS Event Administration'),
		).toBeVisible();
		await expect(canvas.getByText('Owner Operations')).toBeVisible();
		const themeToggle = canvas.getByLabelText('Toggle light or dark theme');
		await userEvent.click(themeToggle);
		await expect(document.body).toHaveClass('dark');
		await userEvent.click(themeToggle);
		document.body.classList.remove('dark');
		const fixtures = getAdminStoryFixtures(canvasElement);
		fixtures.featureEnabled$.next(false);
		await waitFor(() =>
			expect(canvas.getByText('Check in customers')).toHaveAttribute(
				'disabled',
			),
		);
		fixtures.featureEnabled$.next(true);
		await waitFor(() =>
			expect(canvas.getByText('Check in customers')).not.toHaveAttribute(
				'disabled',
			),
		);
	},
} satisfies Meta<typeof LandingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OwnerNavigation: Story = {};

export const CheckInStaffNavigation: Story = {
	decorators: adminStoryDecorators({ isAdmin: false, isOwner: false }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Check in customers')).toBeVisible();
		await expect(
			canvas.queryByText('On-Site Registration'),
		).not.toBeInTheDocument();
		await expect(
			canvas.queryByText('Pre-Register Customers'),
		).not.toBeInTheDocument();
		await expect(canvas.queryByText('Tools')).not.toBeInTheDocument();
		await expect(
			canvas.queryByText('Owner Operations'),
		).not.toBeInTheDocument();
		const fixtures = getAdminStoryFixtures(canvasElement);
		fixtures.isAdmin$.next(true);
		fixtures.isOwner$.next(true);
		await waitFor(() => expect(canvas.getByText('Tools')).toBeVisible());
		await waitFor(() =>
			expect(canvas.getByText('Owner Operations')).toBeVisible(),
		);
		await expect(canvas.getByText('On-Site Registration')).toBeVisible();
		await expect(canvas.getByText('Pre-Register Customers')).toBeVisible();
	},
};

export const SeasonalWorkflowsClosed: Story = {
	decorators: adminStoryDecorators({ featureEnabled: false }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Search for customers')).toBeVisible();
		await expect(canvas.getByText('Check in customers')).toHaveAttribute(
			'disabled',
		);
		await expect(canvas.getByText('On-Site Registration')).toHaveAttribute(
			'disabled',
		);
		await expect(
			canvas.getByText('Pre-Register Customers'),
		).toHaveAttribute('disabled');
	},
};
