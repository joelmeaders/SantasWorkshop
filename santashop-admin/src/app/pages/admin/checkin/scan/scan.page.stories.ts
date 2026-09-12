import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import { ScanPage } from './scan.page';

const meta = {
	title: 'Admin/Check-In/Scan',
	component: ScanPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Check-in entry screen. Camera access stays off until staff select it, and manual code entry remains available.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const manualEntry = canvas.getByText(
			'Enter registration code manually',
		);
		await expect(manualEntry).toBeVisible();
		await userEvent.click(manualEntry);
		await expect(canvas.getByText('Use camera scanner')).toBeVisible();
		await expect(canvasElement.querySelector('zxing-scanner')).toBeFalsy();
	},
} satisfies Meta<typeof ScanPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ManualEntryReady: Story = {};

export const EnglishLight: Story = {
	decorators: adminStoryDecorators(),
	parameters: { adminLanguage: 'en', adminTheme: 'light' },
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(
			await canvas.findByText('Enter registration code manually'),
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
			await canvas.findByText('Enter registration code manually'),
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
			await canvas.findByText(
				'Ingresar código de inscripción manualmente',
			),
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
			await canvas.findByText(
				'Ingresar código de inscripción manualmente',
			),
		).toBeVisible();
		await expect(document.documentElement).toHaveAttribute('lang', 'es');
		await expect(document.documentElement).toHaveAttribute(
			'data-admin-theme',
			'dark',
		);
	},
};
