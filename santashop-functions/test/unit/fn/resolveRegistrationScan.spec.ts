import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveRegistrationCodeMock = vi.fn();

describe('resolveRegistrationScan callable', () => {
	beforeEach(() => {
		vi.resetModules();
		resolveRegistrationCodeMock.mockReset();
		vi.doMock('../../../src/utility/registration-scan', () => ({
			resolveRegistrationCode: resolveRegistrationCodeMock,
		}));
	});

	const loadHandler = async () =>
		(await import('../../../src/fn/resolveRegistrationScan')).default;

	it('normalizes a permitted staff scan before resolving it', async () => {
		resolveRegistrationCodeMock.mockResolvedValue({ disposition: 'eligible' });
		const handler = await loadHandler();

		await expect(
			handler({
				data: { code: ' abcd1234 ', inputMethod: 'camera' },
				auth: { uid: 'staff-1', token: { roles: ['admin', 'checkin'] } },
			} as never),
		).resolves.toEqual({ disposition: 'eligible' });
		expect(resolveRegistrationCodeMock).toHaveBeenCalledWith(
			'abcd1234',
			'camera',
			'staff-1',
		);
	});

	it.each(['', 'XYZ', 'zzzzzzz', '123456789', 'ABCD!234', 'ABC 1234', 'ÁBCD1234'])(
		'rejects invalid manual code %j before registration lookup',
		async (code) => {
			const handler = await loadHandler();
			await expect(
				handler({
					data: { code, inputMethod: 'manual' },
					auth: { uid: 'staff-1', token: { roles: ['checkin'] } },
				} as never),
			).rejects.toMatchObject({
				code: 'invalid-argument',
				message: 'Enter a valid 8-character code.',
			});
			expect(resolveRegistrationCodeMock).not.toHaveBeenCalled();
		},
	);

	it.each(['abc12345', 'ABCDEFGH', '12345678', ' abcd1234 '])(
		'accepts the eight-character manual code contract for %j',
		async (code) => {
			resolveRegistrationCodeMock.mockResolvedValue({ disposition: 'not-found' });
			const handler = await loadHandler();
			await expect(
				handler({
					data: { code, inputMethod: 'manual' },
					auth: { uid: 'staff-1', token: { roles: ['checkin'] } },
				} as never),
			).resolves.toEqual({ disposition: 'not-found' });
			expect(resolveRegistrationCodeMock).toHaveBeenCalledExactlyOnceWith(
				code.trim(),
				'manual',
				'staff-1',
			);
		},
	);

	it.each([
		[
			'authentication is absent',
			{ data: { code: 'ABCD1234', inputMethod: 'camera' } },
			'unauthenticated',
		],
		[
			'the caller lacks a check-in claim',
			{
				data: { code: 'ABCD1234', inputMethod: 'camera' },
				auth: { uid: 'staff-1', token: {} },
			},
			'permission-denied',
		],
		[
			'the code is malformed',
			{
				data: { code: 'too-short', inputMethod: 'camera' },
				auth: { uid: 'staff-1', token: { roles: ['admin', 'checkin'] } },
			},
			'invalid-argument',
		],
		[
			'the input method is unsupported',
			{
				data: { code: 'ABCD1234', inputMethod: 'barcode' },
				auth: { uid: 'staff-1', token: { roles: ['admin', 'checkin'] } },
			},
			'invalid-argument',
		],
	] as const)('rejects when %s', async (_description, request, code) => {
		const handler = await loadHandler();
		await expect(handler(request as never)).rejects.toMatchObject({ code });
		expect(resolveRegistrationCodeMock).not.toHaveBeenCalled();
	});
});
