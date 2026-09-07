import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { deploy } = createRequire(import.meta.url)(
	'../../../../scripts/remote-config-deploy.cjs',
) as { deploy: (env: Record<string, string>, run: (...args: unknown[]) => unknown, inspect: (...args: unknown[]) => Promise<unknown>) => Promise<void> };
const originalArgs = [...process.argv];
afterEach(() => { process.argv = [...originalArgs]; vi.useRealTimers(); });

describe('gateway-first Functions release', () => {
	it('rejects local invocation before any deployment command', async () => {
		process.argv[2] = 'test';
		const run = vi.fn();
		await expect(deploy({ SANTASHOP_FUNCTIONS_DEPLOY: 'test' }, run, vi.fn())).rejects.toThrow('GitHub Actions-only');
		expect(run).not.toHaveBeenCalled();
	});
	it('rejects a mode mismatch before any command', async () => {
		process.argv[2] = 'prod';
		const run = vi.fn();
		await expect(deploy({ GITHUB_ACTIONS: 'true', SANTASHOP_FUNCTIONS_DEPLOY: 'test' }, run, vi.fn())).rejects.toThrow('must match');
		expect(run).not.toHaveBeenCalled();
	});
	it('does not deploy consumers until the private gateway is inspected and configured', async () => {
		process.argv[2] = 'test';
		const env = { GITHUB_ACTIONS: 'true', SANTASHOP_FUNCTIONS_DEPLOY: 'test' } as Record<string, string>;
		const commands: { args: string[]; uri?: string }[] = [];
		const uri = 'https://publicparametersgateway-example-uc.a.run.app';
		const inspect = vi.fn(async () => {
			expect(commands.filter(call => call.args.includes('functions'))).toHaveLength(0);
			return { gatewayUri: uri, problems: [] };
		});
		const run = vi.fn((_command: unknown, args: unknown) => { commands.push({ args: args as string[], uri: env['TEST_SANTASHOP_REMOTE_CONFIG_GATEWAY_URL'] }); });
		await deploy(env, run, inspect);
		const gateway = commands.findIndex(call => call.args.includes('functions:publicParametersGateway'));
		const consumers = commands.findIndex(call => call.args.includes('functions'));
		expect(gateway).toBeGreaterThan(0);
		expect(consumers).toBeGreaterThan(gateway);
		expect(commands[consumers].uri).toBe(uri);
		expect(commands[consumers - 1].args).toEqual(['scripts/remote-config-readiness.cjs', '--project', 'santas-workshop-test']);
		expect(commands[consumers + 1].args).toEqual(['scripts/remote-config-readiness.cjs', '--project', 'santas-workshop-test', '--consumers']);
	});
	it('stops after gateway deployment when its private policy cannot be verified', async () => {
		vi.useFakeTimers();
		process.argv[2] = 'test';
		const run = vi.fn();
		const result = deploy({ GITHUB_ACTIONS: 'true', SANTASHOP_FUNCTIONS_DEPLOY: 'test' }, run, vi.fn(async () => ({ problems: ['public invoker'] })));
		const rejection = expect(result).rejects.toThrow('public invoker');
		await vi.runAllTimersAsync();
		await rejection;
		expect(run.mock.calls.some(call => (call[1] as string[]).includes('functions'))).toBe(false);
	});
});
