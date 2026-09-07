import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import { adminStoryDecorators } from '../../../../../../.storybook/admin/admin-story.providers';
import { ReferralModalComponent } from './referral-modal.component';

const meta = {
	title: 'Admin/Shared/Referral Picker',
	component: ReferralModalComponent,
	decorators: adminStoryDecorators(),
	parameters: {
		docs: {
			description: {
				component:
					'Referring-agency picker with filtering and a validated custom-agency option.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Denver Human Services DHS')).toBeVisible();
		await userEvent.click(canvas.getByText('Other', { exact: true }));
		await expect(canvas.getByText('Choose Referring Agency')).toBeVisible();
		await expect(canvas.getByText('Save').closest('ion-button')).toHaveAttribute('disabled');
	},
} satisfies Meta<typeof ReferralModalComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AgencyList: Story = {};
