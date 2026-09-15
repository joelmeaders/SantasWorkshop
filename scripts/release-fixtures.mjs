export const releaseSha = 'a'.repeat(40);
export const workflowSha = 'b'.repeat(40);
export const repository = 'joelmeaders/SantasWorkshop';

export function fixture(unit = 'functions') {
	const options = {
		releaseRef: releaseSha,
		unit,
		mode: 'test',
		repository,
		workflowRef: `${repository}/.github/workflows/${unit}-test-and-prod-release.yml@refs/heads/master`,
		actor: 'joelmeaders',
		skipTests: false,
	};
	const api = async (path) => {
		if (path === `commits/${releaseSha}`) return { sha: releaseSha };
		if (path === `compare/${releaseSha}...master`)
			return { status: 'ahead' };
		throw new Error(`Unexpected fixture API request: ${path}`);
	};
	return { options, api };
}
