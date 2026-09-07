import type { Request } from 'firebase-functions/v2/https';
import { createFunctionLogger } from '../utility/observability';
import {
	publicParametersGatewayCache,
	type PublicParametersGatewayCache,
} from '../utility/public-parameters-gateway';

const log = createFunctionLogger('publicParametersGateway');

interface GatewayResponse {
	set(name: string, value: string): GatewayResponse;
	status(code: number): GatewayResponse;
	json(body: unknown): void;
}

export const createPublicParametersGatewayHandler = (
	cache: PublicParametersGatewayCache = publicParametersGatewayCache,
) => async (request: Request, response: GatewayResponse): Promise<void> => {
	response.set('Cache-Control', 'private, no-store');
	if (request.method !== 'GET') {
		response.status(405).set('Allow', 'GET').json({ error: 'GET is required.' });
		return;
	}
	try {
		response.status(200).json(await cache.read());
	} catch {
		log.error('Public settings gateway failed.');
		response.status(503).json({ error: 'Public settings are unavailable.' });
	}
};

export const publicParametersGatewayHandler = createPublicParametersGatewayHandler();
