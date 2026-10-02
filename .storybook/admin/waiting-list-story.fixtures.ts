import type {
	WaitingListCampaign,
	WaitingListEmailPreview,
} from '@santashop/models';
import en from '../../santashop-admin/src/assets/email-templates/2026/waiting-list-capacity-2026-en.json';
import es from '../../santashop-admin/src/assets/email-templates/2026/waiting-list-capacity-2026-es.json';

export const waitingEmailFixture = (
	language: 'en' | 'es',
	firstName = 'Jordan',
	blockedImages = false,
): WaitingListEmailPreview => {
	const template = (language === 'es' ? es : en).template;
	const fields: Record<string, string> = {
		firstName,
		registrationUrl: 'https://example.com/pre-registration/overview',
		waitingListUrl:
			'https://example.com/?mode=sign-in&waitingList=manage',
	};
	const render = (value: string): string =>
		value.replace(/{{(\w+)}}/g, (_match, name: string) => fields[name] ?? '');
	const html = render(template.html).replace(/<img\s[^>]*>/g, (image) =>
		blockedImages
			? '<p style="color:white">Denver Santa Claus Shop</p>'
			: image.replace(
					/src="[^"]+"/,
					`src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22190%22 height=%2270%22%3E%3Ctext x=%2295%22 y=%2240%22 text-anchor=%22middle%22 fill=%22white%22%3ESanta Claus Shop%3C/text%3E%3C/svg%3E"`,
				),
	);
	return {
		language,
		templateKey: template.key,
		revisionId: `story-${language}-v1`,
		subject: template.subjectPart,
		html,
		text: render(template.textPart),
	};
};
export const waitingCampaignFixture: WaitingListCampaign = {
	id: 'story-campaign-1',
	programYear: 2026,
	status: 'completed',
	createdAt: '2026-09-17T18:00:00Z',
	updatedAt: '2026-09-17T18:10:00Z',
	memberCount: 24,
	accepted: 20,
	skipped: 4,
	failed: 0,
	uncertain: 0,
};
