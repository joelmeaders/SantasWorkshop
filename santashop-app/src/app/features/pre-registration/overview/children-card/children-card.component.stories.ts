import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
	customerStoryDecorators,
	storyChildren,
} from '../../../../../../../.storybook/registration/customer-story.helpers';
import { ChildrenCardComponent } from './children-card.component';

const meta = {
	title: 'Registration/Workspace/Children Card',
	component: ChildrenCardComponent,
	decorators: customerStoryDecorators(),
	args: { programYear: 2026, saveRequested: fn(), deleteRequested: fn() },
	parameters: {
		docs: {
			description: {
				component:
					'The child roster and the real add or edit dialog used by the registration workspace.',
			},
		},
	},
} satisfies Meta<ChildrenCardComponent>;

export default meta;
type Story = StoryObj<ChildrenCardComponent>;

export const EmptyRoster: Story = {
	args: { children: [], childCount: 0 },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText(/add every child/i)).toBeVisible();
		await userEvent.click(
			canvasElement.querySelector('[data-open-add-child]') as HTMLElement,
		);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-open-add-child]'),
			).toBeNull(),
		);
	},
};

export const ExistingChildren: Story = {
	args: { children: storyChildren, childCount: storyChildren.length },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText('Maya Garcia')).toBeVisible();
		expect(canvas.getByText('Theo Garcia')).toBeVisible();
		await userEvent.click(
			canvasElement.querySelector('[data-child-id="101"]') as HTMLElement,
		);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-open-add-child]'),
			).toBeNull(),
		);
	},
};
