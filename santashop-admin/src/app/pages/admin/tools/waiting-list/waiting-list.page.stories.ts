import {
	applicationConfig,
	type Meta,
	type StoryObj,
} from '@storybook/angular-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type {
	WaitingListCampaign,
	WaitingListCampaignPreview,
} from '@santashop/models';
import { adminStoryDecorators } from '../../../../../../../.storybook/admin/admin-story.providers';
import {
	waitingCampaignFixture,
	waitingEmailFixture,
} from '../../../../../../../.storybook/admin/waiting-list-story.fixtures';
import { WaitingListCampaignService } from './waiting-list-campaign.service';
import { WaitingListPage } from './waiting-list.page';

const meta = {
	title: 'Admin/Waiting List/Campaigns',
	component: WaitingListPage,
	parameters: { layout: 'fullscreen' },
} satisfies Meta<WaitingListPage>;
export default meta;
type Story = StoryObj<WaitingListPage>;
const fixture = (state = 'preview'): Story => ({
	decorators: [
		...adminStoryDecorators(),
		applicationConfig({
			providers: [
				{
					provide: WaitingListCampaignService,
					useFactory: (): object => {
						const preview: WaitingListCampaignPreview = {
							memberCount: state === 'empty' ? 0 : 24,
							canSend: !['empty', 'missing', 'blocked'].includes(state),
							blockedReasons:
								state === 'empty'
									? ['The waiting list is empty.']
									: state === 'missing'
										? ['Publish English and Spanish waiting-list templates.']
										: state === 'blocked'
											? ['Waiting-list email sending is disabled.']
											: [],
							emails:
								state === 'missing'
									? []
									: [waitingEmailFixture('en'), waitingEmailFixture('es')],
						};
						const campaign: WaitingListCampaign = {
							...waitingCampaignFixture,
							status:
								state === 'running'
									? 'running'
									: state === 'paused' || state === 'resume'
										? 'paused'
										: 'completed',
							failed: state === 'partial' ? 2 : 0,
							uncertain: state === 'uncertain' ? 2 : 0,
							updatedAt:
								state === 'running'
									? new Date().toISOString()
									: waitingCampaignFixture.updatedAt,
						};
						const campaigns = [
							'running',
							'paused',
							'complete',
							'partial',
							'uncertain',
							'resume',
						].includes(state)
							? [campaign]
							: [];
						return {
							preview: async (): Promise<WaitingListCampaignPreview> => {
								if (state === 'loading') return new Promise(() => undefined);
								return preview;
							},
							list: async (): Promise<WaitingListCampaign[]> => campaigns,
							read: async (): Promise<WaitingListCampaign> => campaign,
							start: async (): Promise<WaitingListCampaign> => {
								if (state === 'starting') return new Promise(() => undefined);
								return {
									...campaign,
									status: 'running',
									updatedAt: new Date().toISOString(),
								};
							},
							resume: async (): Promise<WaitingListCampaign> => ({
								...campaign,
								status: 'running',
								updatedAt: new Date().toISOString(),
							}),
						};
					},
				},
			],
		}),
	],
});
const start: NonNullable<Story['play']> = async ({
	canvasElement,
}): Promise<void> => {
	const canvas = within(canvasElement);
	const consent = await canvas.findByRole('checkbox');
	const button = canvas
		.getByText('Send capacity emails')
		.closest('ion-button')!;
	await expect(button.disabled).toBe(true);
	await userEvent.click(consent);
	await waitFor(() =>
		expect(getComputedStyle(button).pointerEvents).not.toBe('none'),
	);
	await userEvent.click(button);
};
export const EmptyAudience: Story = fixture('empty');
export const Preview: Story = fixture();
export const Loading: Story = fixture('loading');
export const MissingTemplates: Story = fixture('missing');
export const SendingBlocked: Story = fixture('blocked');
export const Starting: Story = { ...fixture('starting'), play: start };
export const LaunchCampaign: Story = {
	...fixture(),
	play: async (context): Promise<void> => {
		await start(context);
		await expect(
			await within(context.canvasElement).findByText('Campaign results'),
		).toBeVisible();
	},
};
export const Running: Story = fixture('running');
export const Paused: Story = fixture('paused');
export const Complete: Story = {
	...fixture('complete'),
	play: async ({ canvasElement }): Promise<void> => {
		await userEvent.click(
			await within(canvasElement).findByText(/2026-09-17T18:00:00Z/),
		);
	},
};
export const PartialFailure: Story = {
	...fixture('partial'),
	play: Complete.play,
};
export const UncertainDelivery: Story = {
	...fixture('uncertain'),
	play: Complete.play,
};
export const Resume: Story = {
	...fixture('resume'),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await userEvent.click(await canvas.findByText('Resume campaign'));
		await expect(canvas.queryByText('Resume campaign')).not.toBeInTheDocument();
	},
};
export const SpanishLight: Story = {
	...fixture('paused'),
	parameters: { adminLanguage: 'es' },
};
export const SpanishDark: Story = {
	...fixture('paused'),
	parameters: { adminLanguage: 'es', adminTheme: 'dark' },
};
export const EnglishDark: Story = {
	...fixture(),
	parameters: { adminTheme: 'dark' },
};
