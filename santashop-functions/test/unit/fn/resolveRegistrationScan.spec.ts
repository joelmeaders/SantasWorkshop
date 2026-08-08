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
				auth: { uid: 'staff-1', token: { admin: true } },
			} as never),
		).resolves.toEqual({ disposition: 'eligible' });
		expect(resolveRegistrationCodeMock).toHaveBeenCalledWith(
			'abcd1234',
			'camera',
			'staff-1',
		);
	});

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
				auth: { uid: 'staff-1', token: { admin: true } },
			},
			'invalid-argument',
		],
		[
			'the input method is unsupported',
			{
				data: { code: 'ABCD1234', inputMethod: 'barcode' },
				auth: { uid: 'staff-1', token: { admin: true } },
			},
			'invalid-argument',
		],
	] as const)('rejects when %s', async (_description, request, code) => {
		const handler = await loadHandler();
		await expect(handler(request as never)).rejects.toMatchObject({ code });
		expect(resolveRegistrationCodeMock).not.toHaveBeenCalled();
	});
});
