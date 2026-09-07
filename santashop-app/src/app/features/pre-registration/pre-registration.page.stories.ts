import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
	customerStoryDecorators,
	storyRegistration,
} from '../../../../../.storybook/registration/customer-story.helpers';
import { OverviewPage } from './overview/overview.page';
import { PreRegistrationPage } from './pre-registration.page';

const draftRegistration = {
	...storyRegistration,
	registrationSubmittedOn: undefined,
};

const meta = {
	title: 'Registration/Shell/Signed-in Registration',
	component: PreRegistrationPage,
	decorators: customerStoryDecorators({
		registration: draftRegistration,
		routes: [{ path: '', component: OverviewPage }],
	}),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'The production signed-in shell keeps account navigation above the routed registration workspace.',
			},
		},
	},
} satisfies Meta<PreRegistrationPage>;

export default meta;
type Story = StoryObj<PreRegistrationPage>;

export const ReadyForWorkspace: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText('Jordan Garcia')).toBeVisible();
		expect(canvasElement.querySelector('#main')).toBeTruthy();
		expect(canvas.getByText('Maya Garcia')).toHaveTextContent(
			'Maya Garcia',
		);
		const menu = canvasElement.querySelector(
			'#menuButton',
		) as HTMLIonButtonElement;
		await userEvent.click(menu);
		expect(menu).toBeEnabled();
	},
};
