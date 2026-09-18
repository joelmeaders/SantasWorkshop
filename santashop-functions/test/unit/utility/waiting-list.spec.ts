import type { RemoteConfigTemplate } from 'firebase-admin/remote-config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	defaultWaitingListSettings,
	parseWaitingListSettings,
	type Registration,
	type WaitingListEmailPreview,
} from '../../../src/models';
import { waitingListSettingsFromTemplate } from '../../../src/utility/waiting-list-settings';
import { waitingListEligibility } from '../../../src/fn/waitingList';
import { classifyWaitingListSendError } from '../../../src/fn/waitingListEmailWorker';
import {
	sendWaitingListEmail,
	waitingListLinks,
	waitingListSendRate,
} from '../../../src/utility/waiting-list-email';

const send = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/client-ses', async (original) => ({
	...(await original<object>()),
	SESClient: class {
		public send = send;
	},
}));
describe('waiting list guardrails', () => {
	beforeEach(() => send.mockReset());
	const enabled = { joiningEnabled: true, emailSendingEnabled: true };
	it('fails closed independently for malformed or conditional waiting-list settings', () => {
		expect(parseWaitingListSettings(undefined)).toEqual(
			defaultWaitingListSettings(),
		);
		for (const value of [
			null,
			{},
			true,
			{ ...enabled, unexpected: true },
			{ joiningEnabled: 'true', emailSendingEnabled: true },
		])
			expect(() => parseWaitingListSettings(value)).toThrow();
		for (const value of [
			'bad json',
			JSON.stringify({ ...enabled, typo: true }),
		]) {
			const template: RemoteConfigTemplate = {
				etag: 'v1',
				parameters: {
					santashop_waiting_list: {
						valueType: 'JSON',
						defaultValue: { value },
					},
				},
			};
			expect(waitingListSettingsFromTemplate(template)).toEqual(
				defaultWaitingListSettings(),
			);
		}
		const template: RemoteConfigTemplate = {
			etag: 'v1',
			parameters: {
				santashop_waiting_list: {
					valueType: 'JSON',
					defaultValue: { value: JSON.stringify(enabled) },
				},
			},
		};
		expect(waitingListSettingsFromTemplate(template)).toEqual(enabled);
		template.parameters['santashop_waiting_list'].conditionalValues = {
			audience: { value: JSON.stringify(enabled) },
		};
		expect(waitingListSettingsFromTemplate(template)).toEqual(
			defaultWaitingListSettings(),
		);
	});
	it('keeps opt-out available after flag or capacity changes and rejects booked accounts first', () => {
		const draft = { programYear: 2025 } as Registration;
		expect(waitingListEligibility(draft, enabled, false).canJoin).toBe(true);
		expect(waitingListEligibility(draft, enabled, true).canJoin).toBe(false);
		const member = {
			...draft,
			waitingList: {
				active: true,
				source: 'overview' as const,
				joinedOn: new Date(),
				membershipId: 'consent',
			},
		};
		expect(
			waitingListEligibility(member, defaultWaitingListSettings(), true).active,
		).toBe(true);
		expect(
			waitingListEligibility(
				{ ...member, registrationSubmittedOn: new Date() },
				enabled,
				false,
			),
		).toMatchObject({ active: false, canJoin: false });
		expect(
			waitingListEligibility({ ...draft, programYear: 2024 }, enabled, false)
				.canJoin,
		).toBe(false);
	});
	it('paces below verified SES rate and rejects missing or exhausted quota', async () => {
		send.mockResolvedValue({
			MaxSendRate: 8,
			Max24HourSend: 1000,
			SentLast24Hours: 50,
		});
		expect(await waitingListSendRate()).toBe(4);
		send.mockResolvedValue({
			MaxSendRate: 8,
			Max24HourSend: 1000,
			SentLast24Hours: 1000,
		});
		await expect(waitingListSendRate()).rejects.toThrow('quota');
		send.mockResolvedValue({});
		await expect(waitingListSendRate()).rejects.toThrow('quota');
	});
	it('escapes customer names in HTML, preserves plain text, and uses the environment site', async () => {
		const template: WaitingListEmailPreview = {
			language: 'es',
			templateKey: 'capacity-es',
			revisionId: 'revision-1',
			subject: 'Hola {{firstName}}',
			html: '<p>{{firstName}}</p>',
			text: '{{firstName}}',
		};
		send.mockResolvedValue({ MessageId: 'accepted-by-ses' });
		expect(
			await sendWaitingListEmail(
				'recipient@example.com',
				'<Maya> $&',
				template,
			),
		).toBe('accepted-by-ses');
		const input = send.mock.calls[0][0].input;
		expect(input.Message.Body.Html.Data).toBe('<p>&lt;Maya&gt; $&amp;</p>');
		expect(input.Message.Body.Text.Data).toBe('<Maya> $&');
		expect(waitingListLinks().registrationUrl).toBe(
			`${new URL(process.env['SANTASHOP_PASSWORD_RESET_CONTINUE_URL']!).origin}/pre-registration/overview`,
		);
	});
	it('requires a provider receipt and never treats unknown failures as safe to retry', async () => {
		expect(
			classifyWaitingListSendError({ $metadata: { httpStatusCode: 400 } }),
		).toBe('failed');
		expect(
			classifyWaitingListSendError({ $metadata: { httpStatusCode: 503 } }),
		).toBe('uncertain');
		expect(classifyWaitingListSendError(new Error('timeout'))).toBe(
			'uncertain',
		);
		send.mockResolvedValue({});
		await expect(
			sendWaitingListEmail('recipient@example.com', 'Maya', {
				language: 'en',
				templateKey: 'x',
				revisionId: 'v1',
				subject: 'Hello',
				html: '<p>Hello</p>',
				text: 'Hello',
			}),
		).rejects.toThrow('not confirmed');
	});
});
