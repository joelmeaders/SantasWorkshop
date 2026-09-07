import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, waitFor, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../.storybook/admin/admin-story.providers';
import { AppComponent } from './app.component';

const meta = {
	title: 'Admin/Shell/Application',
	component: AppComponent,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'The production Ionic application shell. Routed admin pages render inside its router outlet.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvasElement.querySelector('ion-app')).toBeTruthy();
		const heading = await canvas.findByText('DSCS Event Administration');
		await waitFor(() => expect(heading).toBeVisible());
		document.body.classList.remove('dark');
	},
} satisfies Meta<typeof AppComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LandingRoute: Story = {};
