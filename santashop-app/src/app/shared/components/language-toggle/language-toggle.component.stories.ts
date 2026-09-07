import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, waitFor, within } from 'storybook/test';
import { customerStoryDecorators } from '../../../../../../.storybook/registration/customer-story.helpers';
import { LanguageToggleComponent } from './language-toggle.component';

const meta = {
	title: 'Registration/Controls/Language Toggle',
	component: LanguageToggleComponent,
	decorators: customerStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'The customer language switch persists English or Spanish through the local language service.',
			},
		},
	},
} satisfies Meta<LanguageToggleComponent>;

export default meta;
type Story = StoryObj<LanguageToggleComponent>;

export const EnglishSelected: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toggle = canvas.getByRole('switch', { name: /switch language/i });
		expect(toggle).toBeChecked();
		window.localStorage.removeItem('santashop-language');
		toggle.dispatchEvent(
			new CustomEvent('ionChange', {
				bubbles: true,
				detail: { checked: false },
			}),
		);
		await waitFor(() =>
			expect(window.localStorage.getItem('santashop-language')).toBe(
				'es',
			),
		);
		await waitFor(() => expect(toggle).not.toBeChecked());
	},
};
