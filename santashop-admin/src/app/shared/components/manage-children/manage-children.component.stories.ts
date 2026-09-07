import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	adminStoryDecorators,
	demoChildren,
} from '../../../../../../.storybook/admin/admin-story.providers';
import { ManageChildrenComponent } from './manage-children.component';

const meta = {
	title: 'Admin/Shared/Manage Children',
	component: ManageChildrenComponent,
	decorators: adminStoryDecorators(),
	args: { children: demoChildren },
	parameters: {
		docs: {
			description: {
				component:
					'Child roster used by registration and check-in review. Staff can add, edit, or remove each child.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Ava Rivera')).toBeVisible();
		await expect(canvas.getByText('Mateo Rivera')).toBeVisible();
		await userEvent.click(canvas.getByText('Add Child'));
		await expect(canvas.getByText('2')).toBeVisible();
	},
} satisfies Meta<ManageChildrenComponent>;

export default meta;
type Story = StoryObj<ManageChildrenComponent>;

export const FamilyWithTwoChildren: Story = {};

export const NoChildren: Story = {
	args: { children: [] },
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Add all children 11 years old or younger')).toBeVisible();
		await userEvent.click(canvas.getByText('Add Child'));
	},
};
