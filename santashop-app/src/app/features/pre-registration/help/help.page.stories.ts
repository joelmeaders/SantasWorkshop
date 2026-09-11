import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	customerStoryDecorators,
	getIonButton,
} from '../../../../../../.storybook/registration/customer-story.helpers';
import { HelpPage } from './help.page';

const meta = {
	title: 'Registration/Support/Help',
	component: HelpPage,
	decorators: customerStoryDecorators(),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Customer support contacts and answers shown from the account menu.',
			},
		},
	},
} satisfies Meta<HelpPage>;

export default meta;
type Story = StoryObj<HelpPage>;

export const CustomerHelp: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const close = getIonButton(canvasElement, /go back/i);
		expect(
			canvas.getByRole('heading', { name: /^help$/i, level: 1 }),
		).toBeVisible();
		expect(canvas.getAllByRole('listitem')).toHaveLength(5);
		expect(
			canvas.getByRole('heading', { name: /review and submit/i }),
		).toBeInTheDocument();
		expect(getIonButton(canvasElement, /visit.*website/i)).toHaveAttribute(
			'target',
			'_blank',
		);
		expect(canvasElement.querySelector('[href$=".pdf"]')).toBeNull();
		await userEvent.click(close);
		expect(close).toBeEnabled();
	},
};
