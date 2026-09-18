import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect } from 'storybook/test';
import { waitingEmailFixture } from '../../../../../../../.storybook/admin/waiting-list-story.fixtures';
import { WaitingListEmailPreviewComponent } from './waiting-list-email-preview.component';

const meta = {
	title: 'Admin/Waiting List/Email Previews',
	component: WaitingListEmailPreviewComponent,
	render: (args): { props: typeof args; template: string } => ({
		props: args,
		template:
			'<h1>{{ title }}</h1><admin-waiting-list-email-preview [html]="html" [title]="title" />',
	}),
	parameters: { layout: 'padded' },
} satisfies Meta<WaitingListEmailPreviewComponent>;
export default meta;
type Story = StoryObj<WaitingListEmailPreviewComponent>;
const fixture = (
	language: 'en' | 'es',
	name = 'Jordan',
	blocked = false,
): Story => ({
	args: {
		html: waitingEmailFixture(language, name, blocked).html,
		title: language === 'es' ? 'Vista previa del correo' : 'Email preview',
	},
	play: async ({ args }): Promise<void> => {
		const doc = new DOMParser().parseFromString(args.html, 'text/html');
		await expect(doc.querySelector('a')?.getAttribute('href')).toBe(
			'https://example.com/pre-registration/overview',
		);
		await expect(doc.querySelectorAll('a')[1]?.getAttribute('href')).toBe(
			'https://example.com/?mode=sign-in&waitingList=manage',
		);
	},
});
export const EnglishDesktop: Story = fixture('en');
export const SpanishDesktop: Story = fixture('es');
export const EnglishMobile: Story = {
	...fixture('en'),
	globals: { viewport: { value: 'mobile', isRotated: false } },
};
export const SpanishMobile: Story = {
	...fixture('es'),
	globals: { viewport: { value: 'mobile', isRotated: false } },
};
export const EnglishLongName: Story = fixture(
	'en',
	'Alexandria María de los Ángeles Fernández',
);
export const SpanishLongName: Story = fixture(
	'es',
	'Alexandria María de los Ángeles Fernández',
);
export const EnglishBlockedImages: Story = fixture('en', 'Jordan', true);
export const SpanishBlockedImages: Story = fixture('es', 'Jordan', true);
