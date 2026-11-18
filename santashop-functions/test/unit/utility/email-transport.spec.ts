import { createServer } from 'node:http';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import { describe, expect, it, vi } from 'vitest';
import {
	createEmailSendClient,
	emailSendOptions,
} from '../../../src/utility/email-transport';

const command = (): SendEmailCommand =>
	new SendEmailCommand({
		Source: 'sender@example.com',
		Destination: { ToAddresses: ['customer@example.com'] },
		Message: {
			Subject: { Data: 'Confirmation' },
			Body: { Text: { Data: 'Booked' } },
		},
	});

describe('email payload transport', () => {
	it('sends one payload when the response is lost despite ambient retries', async () => {
		vi.stubEnv('AWS_MAX_ATTEMPTS', '10');
		let requests = 0;
		const server = createServer((request) => {
			request.resume();
			request.on('end', () => {
				requests++;
				request.socket.destroy();
			});
		});
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve),
		);
		const address = server.address();
		if (!address || typeof address === 'string')
			throw new Error('Missing port');
		const client = createEmailSendClient({
			region: 'us-west-2',
			credentials: { accessKeyId: 'fixture', secretAccessKey: 'fixture' },
			endpoint: `http://127.0.0.1:${address.port}`,
		});
		try {
			await expect(
				client.send(command(), emailSendOptions()),
			).rejects.toThrow();
			expect(requests).toBe(1);
		} finally {
			client.destroy();
			await new Promise<void>((resolve) => server.close(() => resolve()));
			vi.unstubAllEnvs();
		}
	});

	it('aborts a stalled request when the send budget expires without another attempt', async () => {
		const controller = new AbortController();
		const timeout = vi
			.spyOn(AbortSignal, 'timeout')
			.mockReturnValue(controller.signal);
		let requests = 0;
		const server = createServer((request) => {
			request.resume();
			request.on('end', () => {
				requests++;
				// Expire the budget only after the real HTTP payload arrives.
				controller.abort(
					new DOMException('Send budget expired', 'TimeoutError'),
				);
			});
		});
		await new Promise<void>((resolve) =>
			server.listen(0, '127.0.0.1', resolve),
		);
		const address = server.address();
		if (!address || typeof address === 'string')
			throw new Error('Missing port');
		const client = createEmailSendClient({
			region: 'us-west-2',
			credentials: { accessKeyId: 'fixture', secretAccessKey: 'fixture' },
			endpoint: `http://127.0.0.1:${address.port}`,
		});
		try {
			await expect(
				client.send(command(), emailSendOptions()),
			).rejects.toMatchObject({ name: 'AbortError' });
			expect(timeout).toHaveBeenCalledExactlyOnceWith(25_000);
			expect(requests).toBe(1);
		} finally {
			client.destroy();
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});
});
