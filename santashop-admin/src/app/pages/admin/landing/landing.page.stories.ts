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
			canvas.getByText('Ready to welcome families'),
		).toBeVisible();
		await expect(canvas.getByText('Owner Operations')).toBeVisible();
		await userEvent.click(
			canvas.getByText('EN / ES'),
		);
		const appearance = await within(document.body).findByLabelText(
			'Appearance',
		);
		await userEvent.selectOptions(appearance, 'dark');
		await expect(document.body).toHaveClass('dark');
		await userEvent.selectOptions(appearance, 'light');
		await expect(document.body).not.toHaveClass('dark');
		await (
			document.querySelector('ion-popover') as HTMLIonPopoverElement
		).dismiss();
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

export const EnglishLight: Story = {
	decorators: adminStoryDecorators(),
	parameters: { adminLanguage: 'en', adminTheme: 'light' },
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('Ready to welcome families'),
		).toBeVisible();
		await expect(document.documentElement).toHaveAttribute('lang', 'en');
		await expect(document.documentElement).toHaveAttribute(
			'data-admin-theme',
			'light',
		);
	},
};

export const EnglishDark: Story = {
	decorators: adminStoryDecorators(),
	parameters: { adminLanguage: 'en', adminTheme: 'dark' },
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('Ready to welcome families'),
		).toBeVisible();
		await expect(document.documentElement).toHaveAttribute('lang', 'en');
		await expect(document.documentElement).toHaveAttribute(
			'data-admin-theme',
			'dark',
		);
	},
};

export const SpanishLight: Story = {
	decorators: adminStoryDecorators(),
	parameters: { adminLanguage: 'es', adminTheme: 'light' },
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('Listos para recibir a las familias'),
		).toBeVisible();
		await expect(document.documentElement).toHaveAttribute('lang', 'es');
		await expect(document.documentElement).toHaveAttribute(
			'data-admin-theme',
			'light',
		);
	},
};

export const SpanishDark: Story = {
	decorators: adminStoryDecorators(),
	parameters: { adminLanguage: 'es', adminTheme: 'dark' },
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('Listos para recibir a las familias'),
		).toBeVisible();
		await expect(document.documentElement).toHaveAttribute('lang', 'es');
		await expect(document.documentElement).toHaveAttribute(
			'data-admin-theme',
			'dark',
		);
	},
};
