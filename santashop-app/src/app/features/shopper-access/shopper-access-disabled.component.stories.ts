import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, within } from 'storybook/test';

import { customerStoryDecorators } from '../../../../../.storybook/registration/customer-story.helpers';
import { ShopperAccessDisabledComponent } from './shopper-access-disabled.component';

const meta = {
	title: 'Registration/Account/Shopper Access Disabled',
	component: ShopperAccessDisabledComponent,
	parameters: {
		docs: {
			description: {
				component:
					'The shopper notice shown after sign-in, with contact information and a cancellation warning only for an active registration.',
			},
		},
	},
} satisfies Meta<ShopperAccessDisabledComponent>;

export default meta;
type Story = StoryObj<ShopperAccessDisabledComponent>;
type Language = 'en' | 'es';

const copy = {
	en: {
		title: 'Your account has been disabled',
		cancellation: 'Otherwise, we will cancel your current registration.',
		copyEmail: 'Copy email address',
		close: 'Close',
	},
	es: {
		title: 'Su cuenta ha sido desactivada',
		cancellation: 'De lo contrario, cancelaremos su inscripción actual.',
		copyEmail: 'Copiar correo electrónico',
		close: 'Cerrar',
	},
};

function notice(language: Language, hasActiveRegistration: boolean): Story {
	return {
		args: { hasActiveRegistration },
		decorators: customerStoryDecorators({ language }),
		play: async ({ canvasElement }): Promise<void> => {
			const canvas = within(canvasElement);
			const labels = copy[language];
			await expect(await canvas.findByText(labels.title)).toBeVisible();
			await expect(
				canvas.getByText('president@denversantaclausshop.org'),
			).toBeVisible();
			await expect(canvas.getByText(labels.copyEmail)).toBeVisible();
			await expect(canvas.getByText(labels.close)).toBeVisible();
			if (hasActiveRegistration) {
				await expect(
					canvas.getByText(labels.cancellation),
				).toBeVisible();
			} else {
				await expect(
					canvas.queryByText(labels.cancellation),
				).not.toBeInTheDocument();
			}
		},
	};
}

export const EnglishWithActiveRegistration: Story = notice('en', true);
export const EnglishWithoutActiveRegistration: Story = notice('en', false);
export const SpanishWithActiveRegistration: Story = notice('es', true);
export const SpanishWithoutActiveRegistration: Story = notice('es', false);
