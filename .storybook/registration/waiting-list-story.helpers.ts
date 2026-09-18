import { applicationConfig } from '@storybook/angular-vite';
import type {
	Registration,
	SetWaitingListMembershipRequest,
	WaitingListState,
} from '@santashop/models';
import { WaitingListService } from '../../santashop-app/src/app/features/waiting-list/waiting-list.service';
import {
	CUSTOMER_STORY_CONTROLS,
	customerStoryDecorators,
	storyRegistration,
	type CustomerStoryControls,
	type CustomerStoryOptions,
} from './customer-story.helpers';

export const waitingDraft: Registration = {
	...storyRegistration,
	registrationSubmittedOn: undefined,
	dateTimeSlot: undefined,
};
export const waitingMember: Registration = {
	...waitingDraft,
	waitingList: {
		active: true,
		source: 'overview',
		joinedOn: new Date('2026-09-15T18:00:00Z'),
		membershipId: 'story-membership',
	},
};
export interface WaitingStoryOptions extends CustomerStoryOptions {
	state?: WaitingListState;
	readResult?: 'pending' | 'error';
	saveResult?: 'pending' | 'error';
}
export const waitingStoryDecorators = (
	options: WaitingStoryOptions = {},
): ReturnType<typeof applicationConfig>[] => [
	...customerStoryDecorators({
		registration: waitingDraft,
		slots: [],
		waitingListSettings: { joiningEnabled: true, emailSendingEnabled: false },
		...options,
	}),
	applicationConfig({
		providers: [
			{
				provide: WaitingListService,
				deps: [CUSTOMER_STORY_CONTROLS],
				useFactory: (controls: CustomerStoryControls): object => {
					let state: WaitingListState = options.state ?? {
						active: false,
						canJoin: true,
						reason: 'eligible',
					};
					let failed = false;
					return {
						read: async (): Promise<WaitingListState> => {
							if (options.readResult === 'pending')
								return new Promise(() => undefined);
							if (options.readResult === 'error' && !failed) {
								failed = true;
								throw new Error('Unavailable');
							}
							return state;
						},
						set: async (
							request: SetWaitingListMembershipRequest,
						): Promise<true> => {
							if (options.saveResult === 'pending')
								return new Promise(() => undefined);
							if (options.saveResult === 'error' && !failed) {
								failed = true;
								throw new Error('Unavailable');
							}
							state = {
								active: request.active,
								canJoin: !request.active,
								reason: request.active ? 'joined' : 'eligible',
							};
							controls.updateRegistration({
								...controls.registration$.value,
								waitingList: {
									...waitingMember.waitingList!,
									active: request.active,
								},
							});
							return true;
						},
					};
				},
			},
		],
	}),
];
