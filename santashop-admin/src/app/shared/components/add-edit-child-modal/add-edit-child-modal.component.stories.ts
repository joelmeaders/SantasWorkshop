import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	adminStoryDecorators,
	demoChildren,
} from '../../../../../../.storybook/admin/admin-story.providers';
import { AddEditChildModalComponent } from './add-edit-child-modal.component';

const meta = {
	title: 'Admin/Shared/Child Editor',
	component: AddEditChildModalComponent,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Child editor with age validation, automatic age-group selection, and toy-type selection.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Child Information')).toBeVisible();
		await expect(canvas.getByText('Save Child').closest('ion-button')).toHaveAttribute(
			'disabled',
		);
		await userEvent.click(canvas.getByText('Cancel'));
	},
} satisfies Meta<AddEditChildModalComponent>;

export default meta;
type Story = StoryObj<AddEditChildModalComponent>;

export const NewChild: Story = {};

export const ExistingChild: Story = {
	args: { child: demoChildren[0] },
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Child Information')).toBeVisible();
		await expect(canvas.getByText('Save Child').closest('ion-button')).not.toHaveAttribute(
			'disabled',
		);
	},
};
