import { REGISTRATION_APP_URL } from './runtime-config';

// Restrict replacement to known customer origins. Public website, FAQ, map,
// logo, and Storage download links are independent of the app environment.
const CUSTOMER_APP_ORIGIN =
	/https?:\/\/(?:register\.denversantaclausshop\.org|test\.denversantaclausshop\.org|santashop-app-test\.(?:web\.app|firebaseapp\.com)|santas-workshop-193b5\.(?:web\.app|firebaseapp\.com))(?:\/|(?=[?#\s"'<>]|$))/gi;

export const normalizeEmailAppLinks = (
	content: string,
	registrationUrl = REGISTRATION_APP_URL,
): string => content.replace(CUSTOMER_APP_ORIGIN, () => registrationUrl);

export const escapeEmailHtml = (value: string): string =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
