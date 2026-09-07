import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	customerStoryDecorators,
	type CustomerStoryControls,
	createCustomerStoryControls,
	getIonButton,
} from '../../../../../../.storybook/registration/customer-story.helpers';
import { ConfirmationPage } from './confirmation.page';

let renderedPermissionControls: CustomerStoryControls | undefined;
const createConfirmedControls = (): CustomerStoryControls => {
	return createCustomerStoryControls();
};
const createPermissionControls = (): CustomerStoryControls => {
	const controls = createCustomerStoryControls();
	renderedPermissionControls = controls;
	return controls;
};

const meta = {
	title: 'Registration/Confirmation/Registration Ticket',
	component: ConfirmationPage,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'The submitted registration ticket includes a synthetic non-valid sample code, appointment, children, and event directions.',
			},
		},
	},
} satisfies Meta<ConfirmationPage>;

export default meta;
type Story = StoryObj<ConfirmationPage>;

export const ConfirmedRegistration: Story = {
	decorators: customerStoryDecorators({ controls: createConfirmedControls }),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByText('Maya Garcia')).toBeVisible();
		expect(canvas.getByText('Theo Garcia')).toBeVisible();
		expect(
			canvasElement.querySelector('#registrationQrCode'),
		).toHaveAttribute(
			'src',
			expect.stringMatching(/^data:image\/svg\+xml/),
		);
		expect(getIonButton(canvasElement, /google maps/i)).toHaveAttribute(
			'target',
			'_blank',
		);
		const change = getIonButton(
			canvasElement,
			/change.*date|change.*time/i,
		);
		await userEvent.click(change);
		expect(change).toBeEnabled();
		expect(
			getIonButton(canvasElement, /cancel registration/i),
		).toBeEnabled();
	},
};

export const PermissionUpdates: Story = {
	decorators: customerStoryDecorators({ controls: createPermissionControls }),
	play: async ({ canvasElement }) => {
		if (!renderedPermissionControls)
			throw new Error('Permission controls were not created');
		expect(
			canvasElement.querySelector('#changeRegistrationButton'),
		).toBeInTheDocument();
		expect(
			canvasElement.querySelector('#cancelRegistrationButton'),
		).toBeInTheDocument();

		renderedPermissionControls.hasCheckedIn$.next(true);
		await waitFor(() => {
			expect(
				canvasElement.querySelector('#changeRegistrationButton'),
			).toBeNull();
			expect(
				canvasElement.querySelector('#cancelRegistrationButton'),
			).toBeNull();
		});

		renderedPermissionControls.hasCheckedIn$.next(false);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('#changeRegistrationButton'),
			).toBeInTheDocument(),
		);

		renderedPermissionControls.allowChangeRegistration$.next(false);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('#changeRegistrationButton'),
			).toBeNull(),
		);
		expect(
			canvasElement.querySelector('#cancelRegistrationButton'),
		).toBeInTheDocument();
	},
};
