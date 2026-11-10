import { createServer } from 'node:http';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import { describe, expect, it, vi } from 'vitest';
import {
	createEmailSendClient,
	emailSendOptions,
	EMAIL_SEND_BUDGET_MS,
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

	it('aborts a stalled request within the send budget without another attempt', async () => {
		let requests = 0;
		const server = createServer((request) => {
			requests++;
			request.resume();
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
		const started = Date.now();
		try {
			await expect(
				client.send(command(), emailSendOptions()),
			).rejects.toThrow();
			expect(Date.now() - started).toBeLessThan(
				EMAIL_SEND_BUDGET_MS + 2_000,
			);
			expect(requests).toBe(1);
		} finally {
			client.destroy();
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	}, 30_000);
});
