import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	getAdminStoryFixtures,
} from '../../../../../../.storybook/admin/admin-story.providers';
import { LandingPage } from './landing.page';

const staffActions = ['Check in customers', 'Search for customers', 'Sign Out'];
const adminActions = [
	'Check in customers',
	'Search for customers',
	'On-Site Registration',
	'Pre-Register Customers',
	'Resend Registration Emails',
	'Schedule & Capacity Editor',
	'Email Templates',
	'User Management',
	'Scan Risk Review',
	'Registration Stats',
	'Check-In Stats',
	'Shopper Stats',
	'Sign Out',
];
const ownerActions = [
	'Check in customers',
	'Search for customers',
	'On-Site Registration',
	'Pre-Register Customers',
	'Resend Registration Emails',
	'Schedule & Capacity Editor',
	'Email Templates',
	'User Management',
	'Waiting list',
	'App settings',
	'Owner Operations',
	'Scan Risk Review',
	'Registration Stats',
	'Check-In Stats',
	'Shopper Stats',
	'Sign Out',
];

async function expectActions(
	canvasElement: HTMLElement,
	actions: string[],
): Promise<void> {
	await waitFor(() =>
		expect(
			Array.from(canvasElement.querySelectorAll('ion-item'), (item) =>
				item.textContent?.trim(),
			),
		).toEqual(actions),
	);
	for (const item of canvasElement.querySelectorAll('ion-item')) {
		await expect(item).toBeVisible();
	}
}

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
		await expectActions(canvasElement, ownerActions);
		await userEvent.click(canvas.getByText('EN / ES'));
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
		await expectActions(canvasElement, staffActions);
		const fixtures = getAdminStoryFixtures(canvasElement);
		try {
			fixtures.isAdmin$.next(true);
			fixtures.isOwner$.next(true);
			await expectActions(canvasElement, ownerActions);
		} finally {
			// Leave the preview in its named role after testing live role changes.
			fixtures.isOwner$.next(false);
			fixtures.isAdmin$.next(false);
		}
		await expectActions(canvasElement, staffActions);
	},
};

export const AdminNavigation: Story = {
	decorators: adminStoryDecorators({ isAdmin: true, isOwner: false }),
	play: async ({ canvasElement }): Promise<void> => {
		await expectActions(canvasElement, adminActions);
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
