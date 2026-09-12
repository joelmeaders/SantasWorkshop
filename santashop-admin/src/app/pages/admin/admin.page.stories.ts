import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, waitFor, within } from 'storybook/test';
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
					'The production admin shell with Home, Check-In, and Search navigation at every viewport size. Scanner, report, and other routes share this shell.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await waitFor(() => {
			const outlet = canvasElement.querySelector('ion-router-outlet');
			const footer = canvasElement.querySelector('ion-footer');
			expect(outlet).not.toBeNull();
			expect(footer).not.toBeNull();
			if (!outlet || !footer) {
				throw new Error('Admin outlet and footer must be rendered.');
			}
			const outletBounds = outlet.getBoundingClientRect();
			const footerBounds = footer.getBoundingClientRect();
			expect(outletBounds.height).toBeGreaterThan(0);
			expect(footerBounds.height).toBeGreaterThan(0);
			expect(outletBounds.bottom).toBeLessThanOrEqual(
				footerBounds.top + 1,
			);
		});
		await expect(canvas.getByText('Home')).toBeInTheDocument();
		await expect(canvas.getByText('Check-In')).toBeInTheDocument();
		await expect(canvas.getByText('Search')).toBeInTheDocument();
		await expect(
			canvas.queryByText('Registration'),
		).not.toBeInTheDocument();
	},
} satisfies Meta<typeof AdminPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllWorkflowsEnabled: Story = {};

export const RegistrationAndCheckInClosed: Story = {
	decorators: adminStoryDecorators({ featureEnabled: false }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Home')).toBeInTheDocument();
		await expect(canvas.getByText('Search')).toBeInTheDocument();
		const checkInTab = canvas
			.getByText('Check-In')
			.closest('ion-tab-button');

		await expect((checkInTab as HTMLIonTabButtonElement).disabled).toBe(
			true,
		);
	},
};
