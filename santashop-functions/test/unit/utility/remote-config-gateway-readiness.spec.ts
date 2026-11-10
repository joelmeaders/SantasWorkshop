import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { assessGateway, assessConsumers, GATEWAY_CONSUMERS } = createRequire(import.meta.url)(
	'../../../../scripts/remote-config-gateway.cjs',
) as {
	assessGateway: (project: string, fn: unknown, policy: unknown, env?: Record<string, string>, service?: unknown) => { problems: string[]; gatewayUri?: string };
	assessConsumers: (project: string, functions: unknown[], uri: string, env?: Record<string, string>) => string[];
	GATEWAY_CONSUMERS: string[];
};
const project = 'santas-workshop-test';
const reader = `remote-config-reader@${project}.iam.gserviceaccount.com`;
const signupRuntime = '312672416598-compute@developer.gserviceaccount.com';
const env = { TEST_SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT: signupRuntime };
const fixture = () => ({
	fn: {
		name: `projects/${project}/locations/us-central1/functions/publicParametersGateway`,
		state: 'ACTIVE',
		serviceConfig: {
			uri: 'https://publicparametersgateway-example-uc.a.run.app',
			service: `projects/${project}/locations/us-central1/services/publicparametersgateway`,
			maxInstanceCount: 2,
			maxInstanceRequestConcurrency: 80,
			serviceAccountEmail: reader,
		},
	},
	service: {
		name: `projects/${project}/locations/us-central1/services/publicparametersgateway`,
		uri: 'https://publicparametersgateway-example-uc.a.run.app',
		invokerIamDisabled: false,
		terminalCondition: { state: 'CONDITION_SUCCEEDED' },
		scaling: { maxInstanceCount: 20 },
		template: { scaling: { maxInstanceCount: 2 }, maxInstanceRequestConcurrency: 80, serviceAccount: reader },
	},
	policy: { bindings: [{ role: 'roles/run.invoker', members: [`serviceAccount:${reader}`, `serviceAccount:${signupRuntime}`], condition: undefined as unknown }] },
});

describe('private settings gateway release gate', () => {
	it.each([
		['santas-workshop-test', 'TEST', '312672416598-compute@developer.gserviceaccount.com'],
		['santas-workshop-193b5', 'PROD', '397997267986-compute@developer.gserviceaccount.com'],
	])('enforces the same private signup access contract for %s', (targetProject, prefix, runtime) => {
		const targetReader = `remote-config-reader@${targetProject}.iam.gserviceaccount.com`;
		const config = { [`${prefix}_SANTASHOP_FUNCTIONS_SERVICE_ACCOUNT`]: runtime };
		const { fn, policy, service } = fixture();
		fn.name = fn.name.replace(project, targetProject);
		fn.serviceConfig.service = fn.serviceConfig.service.replace(project, targetProject);
		fn.serviceConfig.serviceAccountEmail = targetReader;
		service.name = fn.serviceConfig.service;
		service.template.serviceAccount = targetReader;
		policy.bindings[0].members = [`serviceAccount:${targetReader}`, `serviceAccount:${runtime}`];
		expect(assessGateway(targetProject, fn, policy, config, service).problems).toEqual([]);
		const consumers = GATEWAY_CONSUMERS.map(id => ({
			name: `projects/${targetProject}/locations/us-central1/functions/${id}`,
			state: 'ACTIVE',
			serviceConfig: { serviceAccountEmail: id === 'newAccount' ? runtime : targetReader, environmentVariables: { SANTASHOP_REMOTE_CONFIG_GATEWAY_URL: fn.serviceConfig.uri } },
		}));
		expect(assessConsumers(targetProject, consumers, fn.serviceConfig.uri, config)).toEqual([]);
		policy.bindings[0].members.push('serviceAccount:unapproved-runtime@example.com');
		expect(assessGateway(targetProject, fn, policy, config, service).problems).toContainEqual(expect.stringContaining('unexpected invoker'));
	});

	it('includes signup without moving it to the configuration reader identity', () => {
		expect(GATEWAY_CONSUMERS).toContain('newAccount');
		const uri = 'https://publicparametersgateway-example-uc.a.run.app';
		const consumers = GATEWAY_CONSUMERS.map(id => ({
			name: `projects/${project}/locations/us-central1/functions/${id}`,
			state: 'ACTIVE',
			serviceConfig: { serviceAccountEmail: id === 'newAccount' ? signupRuntime : reader, environmentVariables: { SANTASHOP_REMOTE_CONFIG_GATEWAY_URL: uri } },
		}));
		expect(assessConsumers(project, consumers, uri, env)).toEqual([]);
		consumers.find(fn => fn.name.endsWith('/newAccount'))!.serviceConfig.serviceAccountEmail = reader;
		expect(assessConsumers(project, consumers, uri, env)).toEqual([expect.stringContaining('newAccount')]);
	});
	it('requires the configured signup identity and its unconditional gateway access', () => {
		const { fn, policy, service } = fixture();
		policy.bindings[0].members = [`serviceAccount:${reader}`];
		expect(assessGateway(project, fn, policy, env, service).problems).toContainEqual(expect.stringContaining('signup runtime'));
		expect(assessGateway(project, fn, policy, {}, service).problems).toContainEqual(expect.stringContaining('configured signup runtime'));
	});

	it('requires all consumers to use the discovered URI and runtime identity', () => {
		const uri = 'https://publicparametersgateway-example-uc.a.run.app';
		const consumers = GATEWAY_CONSUMERS.map(id => ({
			name: `projects/${project}/locations/us-central1/functions/${id}`,
			state: 'ACTIVE',
			serviceConfig: { serviceAccountEmail: id === 'newAccount' ? signupRuntime : reader, environmentVariables: { SANTASHOP_REMOTE_CONFIG_GATEWAY_URL: uri } },
		}));
		expect(assessConsumers(project, consumers, uri, env)).toEqual([]);
		consumers[0].serviceConfig.environmentVariables.SANTASHOP_REMOTE_CONFIG_GATEWAY_URL = 'https://different.run.app';
		consumers[1].serviceConfig.serviceAccountEmail = 'wrong@example.com';
		consumers.pop();
		expect(assessConsumers(project, consumers, uri, env)).toHaveLength(3);
	});
	it('rejects disabled IAM checks even when the IAM policy has only the reader', () => {
		const { fn, policy, service } = fixture();
		service.invokerIamDisabled = true;
		expect(assessGateway(project, fn, policy, env, service).problems).toContainEqual(expect.stringContaining('permission checks are disabled'));
	});
	it('rejects live revision drift even if the Functions configuration still says two instances', () => {
		const { fn, policy, service } = fixture();
		service.template.scaling.maxInstanceCount = 10;
		expect(assessGateway(project, fn, policy, env, service).problems).toContainEqual(expect.stringContaining('Live gateway revision'));
	});
	it('rejects manual service scaling because it ignores revision limits', () => {
		const { fn, policy, service } = fixture();
		Object.assign(service.scaling, { scalingMode: 'MANUAL', manualInstanceCount: 5 });
		expect(assessGateway(project, fn, policy, env, service).problems).toContainEqual(expect.stringContaining('automatic Cloud Run service scaling'));
	});
	it('requires a matching live Cloud Run service inspection', () => {
		const { fn, policy } = fixture();
		expect(assessGateway(project, fn, policy, env).problems).toContainEqual(expect.stringContaining('live Cloud Run service'));
	});
	it('accepts the exact active two-instance limit and its private reader binding', () => {
		const { fn, policy, service } = fixture();
		expect(assessGateway(project, fn, policy, env, service)).toEqual({ projectId: project, gatewayUri: fn.serviceConfig.uri, problems: [] });
	});
	it.each(['allUsers', 'allAuthenticatedUsers', 'serviceAccount:unexpected@example.com'])('rejects invoker %s even if the reader is also allowed', member => {
		const { fn, policy, service } = fixture();
		policy.bindings[0].members.push(member);
		expect(assessGateway(project, fn, policy, env, service).problems.length).toBeGreaterThan(0);
	});
	it('rejects a conditional binding that cannot prove runtime access', () => {
		const { fn, policy, service } = fixture();
		policy.bindings[0].condition = { expression: 'false', title: 'deny' };
		expect(assessGateway(project, fn, policy, env, service).problems).toContainEqual(expect.stringContaining('unconditional'));
	});
	it.each([0, 1, 3, 50])('rejects a gateway instance limit outside the contract: %i', max => {
		const { fn, policy, service } = fixture();
		fn.serviceConfig.maxInstanceCount = max;
		expect(assessGateway(project, fn, policy, env, service).problems).toContainEqual(expect.stringContaining('maxInstanceCount=2'));
	});
	it('rejects cross-project discovery and a different runtime identity', () => {
		const { fn, policy, service } = fixture();
		fn.name = fn.name.replace(project, 'santas-workshop-193b5');
		fn.serviceConfig.serviceAccountEmail = 'other@example.com';
		expect(assessGateway(project, fn, policy, env, service).problems).toHaveLength(2);
	});
	it.each(['http://example.run.app', 'https://example.com', 'https://example.run.app/path', 'https://user:pass@example.run.app', 'https://example.run.app?secret=x'])('rejects noncanonical URI %s', uri => {
		const { fn, policy, service } = fixture();
		fn.serviceConfig.uri = uri;
		expect(assessGateway(project, fn, policy, env, service).problems).toContainEqual(expect.stringContaining('canonical HTTPS'));
	});
	it('rejects a canonical Cloud Run URI that the consumer client cannot accept', () => {
		const { fn, policy, service } = fixture();
		fn.serviceConfig.uri = 'https://different-service-uc.a.run.app';
		service.uri = fn.serviceConfig.uri;
		expect(assessGateway(project, fn, policy, env, service).problems).toContainEqual(expect.stringContaining('canonical HTTPS'));
	});
});
