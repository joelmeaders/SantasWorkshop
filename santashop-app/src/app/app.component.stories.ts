import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, within } from 'storybook/test';
import { customerStoryDecorators } from '../../../.storybook/registration/customer-story.helpers';
import { AppComponent } from './app.component';
import { HomePage } from './home/home.page';

const meta = {
	title: 'Registration/Shell/Application',
	component: AppComponent,
	decorators: customerStoryDecorators({
		currentUser: null,
		mode: 'choose',
		routes: [{ path: '', component: HomePage }],
	}),
	parameters: {
		docs: {
			description: {
				component:
					'The production Ionic application shell initializes language, analytics, global alerts, and routed customer content.',
			},
		},
	},
} satisfies Meta<AppComponent>;

export default meta;
type Story = StoryObj<AppComponent>;

export const ReadyForRouting: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvasElement.querySelector('ion-app')).toBeTruthy();
		expect(canvasElement.querySelector('ion-router-outlet')).toBeTruthy();
		expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(
			/denver santa claus shop/i,
		);
		expect(
			canvasElement.querySelector('#createAccountButton'),
		).toBeEnabled();
	},
};
