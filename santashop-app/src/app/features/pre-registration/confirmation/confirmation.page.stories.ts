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
		const information = canvasElement.querySelector('#event-information');
		expect(information).toHaveTextContent('1812 35th Street');
		expect(information).toHaveTextContent('Denver, CO 80216');
		expect(information).toHaveTextContent(
			'December 11, 12, 14, and 15, 2026',
		);
		expect(information).toHaveTextContent(
			'Parking is on the west side of the building off of Brighton Blvd.',
		);
		expect(getIonButton(canvasElement, /google maps/i)).toHaveProperty(
			'href',
			'https://www.google.com/maps/dir/?api=1&destination=1812%2035th%20Street%2C%20Denver%2C%20CO%2080216',
		);
		expect(getIonButton(canvasElement, /apple maps/i)).toHaveProperty(
			'href',
			'https://maps.apple.com/?daddr=1812%2035th%20Street%2C%20Denver%2C%20CO%2080216',
		);
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

export const ConfirmedRegistrationSpanish: Story = {
	decorators: customerStoryDecorators({
		controls: createConfirmedControls,
		language: 'es',
	}),
	play: async ({ canvasElement }) => {
		const information = canvasElement.querySelector('#event-information');
		expect(information).toHaveTextContent('1812 35th Street');
		expect(information).toHaveTextContent('Denver, CO 80216');
		expect(information).toHaveTextContent(
			'11, 12, 14 y 15 de diciembre de 2026',
		);
		expect(information).toHaveTextContent(
			'lado oeste del edificio, con acceso desde Brighton Blvd.',
		);
		expect(getIonButton(canvasElement, /google maps/i)).toHaveProperty(
			'href',
			'https://www.google.com/maps/dir/?api=1&destination=1812%2035th%20Street%2C%20Denver%2C%20CO%2080216',
		);
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
