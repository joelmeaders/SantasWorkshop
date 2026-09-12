import {
	moduleMetadata,
	type Meta,
	type StoryObj,
} from '@storybook/angular-vite';
import { IonModal } from '@ionic/angular/standalone';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	customerStoryDecorators,
	getIonButton,
} from '../../../../../../.storybook/registration/customer-story.helpers';
import { HelpPage } from './help.page';

const meta = {
	title: 'Registration/Support/Help',
	component: HelpPage,
	decorators: customerStoryDecorators(),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Customer support contacts and answers shown from the account menu.',
			},
		},
	},
} satisfies Meta<HelpPage>;

export default meta;
type Story = StoryObj<HelpPage>;

export const HelpSheet: Story = {
	decorators: [moduleMetadata({ imports: [IonModal] })],
	render: () => ({
		template:
			'<button type="button" id="open-sheet">Open sheet</button><ion-modal trigger="open-sheet" [animated]="false" [initialBreakpoint]="1" [breakpoints]="[0, 1]" aria-label="Help"><ng-template><app-help class="ion-page" /></ng-template></ion-modal>',
	}),
	play: async ({ canvasElement }) => {
		const modal = canvasElement.querySelector(
			'ion-modal',
		) as HTMLIonModalElement;
		await userEvent.click(
			within(canvasElement).getByRole('button', { name: 'Open sheet' }),
		);
		await waitFor(() => expect(modal).toBeVisible(), { timeout: 10000 });
		await waitFor(() =>
			expect(modal.querySelector('ion-card')).not.toBeNull(),
		);
		const content = modal.querySelector(
			'ion-content',
		) as HTMLIonContentElement;
		await waitFor(() =>
			expect(content.getBoundingClientRect().height).toBeGreaterThan(200),
		);
		await waitFor(() => {
			const card = modal.querySelector('ion-card') as HTMLElement;
			expect(
				card.getBoundingClientRect().width /
					content.getBoundingClientRect().width,
			).toBeGreaterThan(0.8);
		});
		await content.scrollToBottom(0);
		expect(
			within(modal).getByRole('heading', { name: /need more help/i }),
		).toBeVisible();
		const contact = modal.querySelector('.help-contact') as HTMLElement;
		expect(contact.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			content.getBoundingClientRect().bottom,
		);
		await content.scrollToTop(0);
	},
};

export const CustomerHelp: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const close = getIonButton(canvasElement, /go back/i);
		expect(
			canvas.getByRole('heading', { name: /^help$/i, level: 1 }),
		).toBeVisible();
		expect(canvas.getAllByRole('listitem')).toHaveLength(5);
		expect(
			canvas.getByRole('heading', { name: /review and submit/i }),
		).toBeInTheDocument();
		expect(getIonButton(canvasElement, /visit.*website/i)).toHaveAttribute(
			'target',
			'_blank',
		);
		expect(canvasElement.querySelector('[href$=".pdf"]')).toBeNull();
		await userEvent.click(close);
		expect(close).toBeEnabled();
	},
};
