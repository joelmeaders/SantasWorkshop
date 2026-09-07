import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { customerStoryDecorators } from '../../../../../../.storybook/registration/customer-story.helpers';
import { PrivacyPolicyModalComponent } from './privacy-policy-modal.component';

const meta = {
	title: 'Registration/Legal/Privacy Policy',
	component: PrivacyPolicyModalComponent,
	decorators: customerStoryDecorators(),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'The full privacy policy displayed before account creation.',
			},
		},
	},
} satisfies Meta<PrivacyPolicyModalComponent>;

export default meta;
type Story = StoryObj<PrivacyPolicyModalComponent>;

export const FullPolicy: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getAllByRole('heading')).toHaveLength(2);
		const content = canvasElement.querySelector(
			'ion-content',
		) as HTMLIonContentElement;
		const section = canvasElement.querySelector('section') as HTMLElement;
		const scrollElement = await content.getScrollElement();
		await content.scrollToTop(0);
		section.focus({ preventScroll: true });
		expect(section).toHaveFocus();
		const initialScrollTop = scrollElement.scrollTop;
		// Synthetic keyboard events do not run Chromium's native page scrolling.
		section.addEventListener(
			'keydown',
			(event) => {
				if (event.key === 'PageDown')
					scrollElement.scrollBy({
						top: Math.max(scrollElement.clientHeight, 1),
					});
			},
			{ once: true },
		);
		await userEvent.keyboard('{PageDown}');
		await waitFor(() =>
			expect(scrollElement.scrollTop).toBeGreaterThan(initialScrollTop),
		);
		const close = canvasElement.querySelector(
			'#closePrivacyPolicyButton',
		) as HTMLIonButtonElement;
		await userEvent.click(close);
		expect(close).toBeEnabled();
	},
};
