import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, within } from 'storybook/test';
import { customerStoryDecorators } from '../../../../../.storybook/registration/customer-story.helpers';
import { OperationalNoticeComponent } from './operational-notice.component';

const meta = {
	title: 'Registration/Status/Operational Notice',
	component: OperationalNoticeComponent,
	decorators: customerStoryDecorators({
		messageEn: 'Registration will reopen after a short system update.',
		messageEs:
			'El registro volverá a abrir después de una breve actualización.',
	}),
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'A blocking production notice for maintenance, weather closures, or closed registration.',
			},
		},
	},
} satisfies Meta<OperationalNoticeComponent>;

export default meta;
type Story = StoryObj<OperationalNoticeComponent>;

export const Maintenance: Story = {
	args: { mode: 'maintenance' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const notice = canvas.getByRole('alert');
		expect(notice).toHaveTextContent(
			'Registration will reopen after a short system update.',
		);
		expect(canvas.getByRole('img')).toHaveAttribute(
			'src',
			'assets/images/maintenance.png',
		);
		expect(canvas.getByRole('navigation')).toHaveAccessibleName(
			/santa shop updates/i,
		);
	},
};

export const WeatherClosure: Story = {
	args: { mode: 'weather' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByRole('alert')).toHaveTextContent(
			'Registration will reopen after a short system update.',
		);
		expect(canvas.getByRole('img')).toHaveAttribute(
			'src',
			'assets/images/bad-weather.png',
		);
	},
};

export const RegistrationClosed: Story = {
	args: { mode: 'registration-closed' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		expect(canvas.getByRole('alert')).toHaveTextContent(/registration/i);
		expect(canvas.getByRole('img')).toHaveAttribute(
			'src',
			'assets/images/registration-closed.png',
		);
	},
};
