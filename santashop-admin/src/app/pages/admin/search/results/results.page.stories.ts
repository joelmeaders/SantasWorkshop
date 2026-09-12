import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	adminStoryDecorators,
	demoSearchResults,
	getAdminStoryFixtures,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { ResultsPage } from './results.page';

const meta = {
	title: 'Admin/Search/Results',
	component: ResultsPage,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Customer search results with refresh, three sort orders, and direct navigation to check-in review.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByText('Refresh results'));
		await expect(await canvas.findByText('2 Results')).toBeVisible();
		const emailSort = canvas.getByText('Email');
		await userEvent.click(emailSort);
		await expect(emailSort.closest('ion-chip')).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		const fixtures = getAdminStoryFixtures(canvasElement);
		fixtures.searchResults$.next([demoSearchResults[1]]);
		await expect(await canvas.findByText('1 Result')).toBeVisible();
		await waitFor(() =>
			expect(canvas.queryByText(/Elena Rivera/)).not.toBeInTheDocument(),
		);
	},
} satisfies Meta<typeof ResultsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MatchingFamilies: Story = {};

export const NoSearchEntered: Story = {
	decorators: adminStoryDecorators({ searchResults: null }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('No search was entered')).toBeVisible();
		const fixtures = getAdminStoryFixtures(canvasElement);
		fixtures.searchResults$.next([...demoSearchResults]);
		await waitFor(() =>
			expect(canvas.getByText('Refresh results')).toBeVisible(),
		);
		await userEvent.click(canvas.getByText('Refresh results'));
		await expect(await canvas.findByText('2 Results')).toBeVisible();
		await waitFor(() =>
			expect(
				canvas.queryByText('No search was entered'),
			).not.toBeInTheDocument(),
		);
	},
};

export const EnglishLight: Story = {
	decorators: adminStoryDecorators(),
	parameters: { adminLanguage: 'en', adminTheme: 'light' },
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(await canvas.findByText('Refresh results')).toBeVisible();
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
		await expect(await canvas.findByText('Refresh results')).toBeVisible();
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
			await canvas.findByText('Actualizar resultados'),
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
			await canvas.findByText('Actualizar resultados'),
		).toBeVisible();
		await expect(document.documentElement).toHaveAttribute('lang', 'es');
		await expect(document.documentElement).toHaveAttribute(
			'data-admin-theme',
			'dark',
		);
	},
};
