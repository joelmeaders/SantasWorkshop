import { lookup } from 'node:dns/promises';
import { connect } from 'node:net';
import { isEmailSink } from './email-isolation';

const probePort = (address: string, port: number): Promise<boolean> =>
	new Promise((resolve, reject) => {
		// TCP only: never performs TLS, authentication, SMTP, or an SES request.
		const socket = connect({ host: address, port, family: 4 });
		socket.setTimeout(3000);
		socket.once('connect', () => {
			socket.destroy();
			resolve(true);
		});
		socket.once('timeout', () => {
			socket.destroy();
			resolve(false);
		});
		socket.once('error', (error: Error & { code?: string }) => {
			socket.destroy();
			if (
				['ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH'].includes(
					error.code ?? '',
				)
			)
				resolve(false);
			else reject(error);
		});
	});

export const probeEmailIsolation = async (): Promise<
	Record<string, unknown>
> => {
	if (!isEmailSink())
		throw new Error(
			'The email isolation probe is disabled outside isolated test.',
		);
	const google = await lookup('firestore.googleapis.com', { family: 4 });
	if (
		![
			'199.36.153.8',
			'199.36.153.9',
			'199.36.153.10',
			'199.36.153.11',
		].includes(google.address)
	) {
		throw new Error(
			'Google API DNS does not resolve to Private Google Access.',
		);
	}
	const googleReachable = await probePort(google.address, 443);
	const destinations = [
		{ host: 'email.us-west-2.amazonaws.com', port: 443 },
		{ host: 'email.us-east-1.amazonaws.com', port: 443 },
		{ host: 'email-smtp.us-west-2.amazonaws.com', port: 587 },
		{ host: 'email-smtp.us-west-2.amazonaws.com', port: 465 },
	];
	const probes = await Promise.all(
		destinations.map(async ({ host, port }) => {
			const { address } = await lookup(host, { family: 4 });
			return {
				host,
				port,
				address,
				reachable: await probePort(address, port),
			};
		}),
	);
	return {
		checkedAt: new Date().toISOString(),
		revision: process.env['K_REVISION'],
		simulated: true,
		awsConfigurationPresent: false,
		googleReachable,
		probes,
	};
};
