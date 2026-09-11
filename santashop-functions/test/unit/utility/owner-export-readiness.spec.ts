import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const { inspectOwnerExportReadiness } = createRequire(import.meta.url)(
	'../../../../scripts/owner-export-readiness.cjs',
) as {
	inspectOwnerExportReadiness: (
		project: string,
		request: (
			url: string,
			description: string,
			method?: string,
		) => Promise<unknown>,
	) => Promise<{
		projectId: string;
		runtimeServiceAccount: string;
		phase: string;
	}>;
};

const projectId = 'santas-workshop-test';
const runtime = '312672416598-compute@developer.gserviceaccount.com';
const self = `serviceAccount:${runtime}`;
const role = 'roles/iam.serviceAccountTokenCreator';
const fixture = () => ({
	fn: {
		name: `projects/${projectId}/locations/us-central1/functions/callableGetOwnerExportUrl`,
		state: 'ACTIVE',
		serviceConfig: { serviceAccountEmail: runtime },
	},
	account: { projectId, email: runtime, disabled: false },
	project: { projectId, projectNumber: '312672416598' },
	api: { state: 'ENABLED' },
	policy: {
		bindings: [{ role, members: [self] }] as Array<{
			role: string;
			members: string[];
			condition?: { expression: string };
		}>,
	},
});
const requestFor = (
	data: ReturnType<typeof fixture>,
): ReturnType<typeof vi.fn> =>
	vi.fn(async (url: string): Promise<unknown> => {
		if (url.includes(':getIamPolicy')) return data.policy;
		if (url.includes('cloudfunctions.googleapis.com')) return data.fn;
		if (url.includes('iam.googleapis.com')) return data.account;
		if (url.includes('cloudresourcemanager.googleapis.com'))
			return data.project;
		if (url.includes('serviceusage.googleapis.com')) return data.api;
		throw new Error(`Unexpected inspection URL: ${url}`);
	});

describe('owner export signing configuration', () => {
	it('checks the deployed runtime resource and version 3 policy without signing or reading exports', async () => {
		const request = requestFor(fixture());
		await expect(
			inspectOwnerExportReadiness(projectId, request),
		).resolves.toEqual({
			projectId,
			runtimeServiceAccount: runtime,
			phase: 'owner-export-signing-configuration-only',
		});
		expect(request).toHaveBeenCalledTimes(5);
		expect(request).toHaveBeenLastCalledWith(
			expect.stringContaining(
				':getIamPolicy?options.requestedPolicyVersion=3',
			),
			expect.stringContaining('iam.serviceAccounts.getIamPolicy'),
			'POST',
		);
		expect(request.mock.calls.map(([url]) => url)).toContain(
			`https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts/${encodeURIComponent(runtime)}:getIamPolicy?options.requestedPolicyVersion=3`,
		);
		expect(request.mock.calls.map(([url]) => url).join('\n')).not.toMatch(
			/signBlob|storage\.googleapis/,
		);
	});

	it.each([
		'wrong-project',
		'missing-runtime',
		'inactive',
		'foreign-account',
		'disabled-account',
		'wrong-project-number',
		'disabled-api',
	])('rejects %s before inspecting the signing policy', async (invalid) => {
		const data = fixture();
		if (invalid === 'wrong-project')
			data.fn.name = data.fn.name.replace(
				projectId,
				'santas-workshop-193b5',
			);
		if (invalid === 'missing-runtime')
			data.fn.serviceConfig.serviceAccountEmail = '';
		if (invalid === 'inactive') data.fn.state = 'DEPLOYING';
		if (invalid === 'foreign-account')
			data.account.projectId = 'santas-workshop-193b5';
		if (invalid === 'disabled-account') data.account.disabled = true;
		if (invalid === 'wrong-project-number') data.project.projectNumber = '';
		if (invalid === 'disabled-api') data.api.state = 'DISABLED';
		const request = requestFor(data);
		await expect(
			inspectOwnerExportReadiness(projectId, request),
		).rejects.toThrow();
		expect(
			request.mock.calls.some(([url]) => url.includes(':getIamPolicy')),
		).toBe(false);
	});

	it.each(['missing', 'wrong-member', 'conditional', 'custom-role'])(
		'reports an unsupported signing configuration for a %s grant without claiming no effective permission',
		async (invalid) => {
			const data = fixture();
			if (invalid === 'missing') data.policy.bindings = [];
			if (invalid === 'wrong-member')
				data.policy.bindings[0].members = [
					'serviceAccount:deployer@example.test',
				];
			if (invalid === 'conditional')
				data.policy.bindings[0].condition = { expression: 'true' };
			if (invalid === 'custom-role')
				data.policy.bindings[0].role = `projects/${projectId}/roles/customSigner`;
			await expect(
				inspectOwnerExportReadiness(projectId, requestFor(data)),
			).rejects.toThrow(
				'Other grants may provide iam.serviceAccounts.signBlob but are not evaluated by this check.',
			);
		},
	);

	it('does not mistake an unreadable IAM policy for verified readiness', async () => {
		const request = requestFor(fixture());
		const read = request.getMockImplementation() as (
			url: string,
		) => Promise<unknown>;
		request.mockImplementation(async (url: string): Promise<unknown> => {
			if (url.includes(':getIamPolicy'))
				throw new Error('IAM policy HTTP 403');
			return read(url);
		});
		await expect(
			inspectOwnerExportReadiness(projectId, request),
		).rejects.toThrow('IAM policy HTTP 403');
	});

	it('requires an explicit supported project before any cloud request', async () => {
		const request = requestFor(fixture());
		await expect(
			inspectOwnerExportReadiness('other-project', request),
		).rejects.toThrow('explicit supported');
		expect(request).not.toHaveBeenCalled();
	});
});
