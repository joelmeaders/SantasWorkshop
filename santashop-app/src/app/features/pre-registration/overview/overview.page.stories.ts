import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	customerStoryDecorators,
	type CustomerStoryControls,
	createCustomerStoryControls,
	getIonButton,
	storyRegistration,
} from '../../../../../../.storybook/registration/customer-story.helpers';
import { OverviewPage } from './overview.page';

const draftRegistration = {
	...storyRegistration,
	registrationSubmittedOn: undefined,
};
const emptyDraftRegistration = {
	...draftRegistration,
	children: [],
	dateTimeSlot: undefined,
};

let renderedReadyControls: CustomerStoryControls | undefined;
let renderedReadinessControls: CustomerStoryControls | undefined;
const createReadyControls = (): CustomerStoryControls => {
	const controls = createCustomerStoryControls({
		registration: draftRegistration,
	});
	renderedReadyControls = controls;
	return controls;
};
const createReadinessControls = (): CustomerStoryControls => {
	const controls = createCustomerStoryControls({
		registration: emptyDraftRegistration,
	});
	renderedReadinessControls = controls;
	return controls;
};

const meta = {
	title: 'Registration/Workspace/Registration Overview',
	component: OverviewPage,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'The complete customer workspace combines child, appointment, review, email, and submission actions.',
			},
		},
	},
} satisfies Meta<OverviewPage>;

export default meta;
type Story = StoryObj<OverviewPage>;

export const ReadyToSubmit: Story = {
	decorators: customerStoryDecorators({ controls: createReadyControls }),
	play: async ({ canvasElement }) => {
		if (!renderedReadyControls)
			throw new Error('Overview controls were not created');
		const canvas = within(canvasElement);
		expect(
			canvas.getByRole('heading', { name: /registration/i, level: 1 }),
		).toBeVisible();
		expect(canvas.getByText('Maya Garcia')).toBeVisible();
		const nudge = canvasElement.querySelector(
			'#reviewAndSubmitButton',
		) as HTMLIonButtonElement;
		await userEvent.click(nudge);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('#reviewAndSubmitButton'),
			).toBeNull(),
		);
		await userEvent.click(getIonButton(canvasElement, /make changes/i));
		await waitFor(() =>
			expect(
				canvasElement.querySelector('#reviewAndSubmitButton'),
			).toBeInTheDocument(),
		);
	},
};

export const RegistrationReadinessUpdates: Story = {
	decorators: customerStoryDecorators({ controls: createReadinessControls }),
	play: async ({ canvasElement }) => {
		if (!renderedReadinessControls)
			throw new Error('Readiness controls were not created');
		const canvas = within(canvasElement);
		expect(
			canvasElement.querySelector('#reviewAndSubmitButton'),
		).toBeNull();

		renderedReadinessControls.updateRegistration(draftRegistration);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('#reviewAndSubmitButton'),
			).toBeInTheDocument(),
		);
		expect(canvas.getByText('Maya Garcia')).toBeVisible();

		renderedReadinessControls.updateRegistration(emptyDraftRegistration);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('#reviewAndSubmitButton'),
			).toBeNull(),
		);
		expect(canvas.getByText(/add every child/i)).toBeVisible();
	},
};
