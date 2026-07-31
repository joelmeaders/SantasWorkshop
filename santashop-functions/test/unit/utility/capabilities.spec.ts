import { describe, expect, it } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import {
	canCheckInToken,
	isAdminToken,
	isOwnerToken,
	requireOwner,
	requireRecentAuthentication,
} from '../../../src/utility/capabilities';

const request = (
	token?: Record<string, unknown>,
	uid = 'owner-1',
): CallableRequest<unknown> =>
	({
		data: {},
		...(token ? { auth: { uid, token } } : {}),
	}) as CallableRequest<unknown>;

describe('capability hierarchy', () => {
	it('makes owner imply admin and check-in access', () => {
		const token = { owner: true };

		expect(isOwnerToken(token)).toBe(true);
		expect(isAdminToken(token)).toBe(true);
		expect(canCheckInToken(token)).toBe(true);
	});

	it('keeps ordinary admin and check-in claims below owner', () => {
		expect(isOwnerToken({ admin: true })).toBe(false);
		expect(isAdminToken({ roles: ['admin'] })).toBe(true);
		expect(canCheckInToken({ roles: ['checkin'] })).toBe(true);
		expect(isAdminToken({ roles: ['checkin'] })).toBe(false);
	});

	it('requires authentication and the immutable owner claim', () => {
		expect(() => requireOwner(request())).toThrow(
			expect.objectContaining({ code: 'unauthenticated' }),
		);
		expect(() => requireOwner(request({ admin: true }))).toThrow(
			expect.objectContaining({ code: 'permission-denied' }),
		);
		expect(requireOwner(request({ owner: true }))).toEqual({
			uid: 'owner-1',
			token: { owner: true },
		});
	});

	it('requires authentication no older than five minutes', () => {
		const now = new Date('2026-07-30T12:00:00.000Z');

		expect(() =>
			requireRecentAuthentication(
				{ auth_time: now.getTime() / 1000 - 300 },
				now,
			),
		).not.toThrow();
		expect(() =>
			requireRecentAuthentication(
				{ auth_time: now.getTime() / 1000 - 301 },
				now,
			),
		).toThrow(expect.objectContaining({ code: 'failed-precondition' }));
		expect(() => requireRecentAuthentication({}, now)).toThrow(
			expect.objectContaining({ code: 'failed-precondition' }),
		);
	});
});
