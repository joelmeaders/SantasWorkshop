import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../.storybook/admin/admin-story.providers';
import { HeaderComponent } from './header.component';

const meta = {
	title: 'Admin/Shared/Header',
	component: HeaderComponent,
	decorators: adminStoryDecorators(),
	args: { title: 'Customer Check-In', backRoute: '/admin/landing' },
	parameters: {
		docs: {
			description: {
				component:
					'Shared page header with a clear page title and back navigation to the admin landing page.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Customer Check-In')).toBeVisible();
		await expect(canvasElement.querySelector('ion-button')).toBeTruthy();
	},
} satisfies Meta<HeaderComponent>;

export default meta;
type Story = StoryObj<HeaderComponent>;

export const Default: Story = {};
