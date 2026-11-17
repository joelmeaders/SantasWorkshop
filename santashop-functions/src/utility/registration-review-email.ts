import { escapeEmailHtml } from './email-links';
import { REVIEW_REPLY_TO } from './registration-review-actions';

export const reviewEmailActions = [
	'contact',
	'editChild',
	'removeChild',
	'restoreChild',
	'disable',
	'enable',
	'cancel',
	'reinstate',
	'blacklist',
	'unblacklist',
] as const;

export type ReviewEmailAction = (typeof reviewEmailActions)[number];
type Language = 'en' | 'es';

const english: Record<ReviewEmailAction, readonly [string, string]> = {
	contact: [
		'Please confirm your Santa Shop registration',
		'We found two registrations that may include some of the same children. Please reply and tell us which registration should remain, or cancel the extra registration if you can. We have not changed your registration.',
	],
	editChild: [
		'A child entry on your Santa Shop registration was updated',
		'We updated a child entry on your registration. Please reply if anything still needs to be corrected.',
	],
	removeChild: [
		'A child entry was removed from your Santa Shop registration',
		'A child entry is no longer included on your registration. Please reply if you think this needs to be corrected.',
	],
	restoreChild: [
		'A child entry was restored to your Santa Shop registration',
		'We restored a child entry to your registration. Please reply if anything still needs to be corrected.',
	],
	disable: [
		'An update to your Santa Shop access',
		'We paused access to your shopper account. This did not cancel your registration or release your appointment. Please reply if you think this was a mistake or need help.',
	],
	enable: [
		'Your Santa Shop access has been restored',
		'You can use your shopper account again. This did not change your registration or appointment.',
	],
	cancel: [
		'Your Santa Shop registration was canceled',
		'Your registration was canceled and your appointment is no longer reserved. Please do not use the previous confirmation to check in. Reply if you think this was a mistake or need help.',
	],
	reinstate: [
		'Your Santa Shop registration has been restored',
		'We restored your registration to its original appointment. Open your registration for the current check-in confirmation.',
	],
	blacklist: [
		'An update to your Santa Shop account email',
		'This email address cannot be used for Santa Shop registrations, including future events. Please reply if you think this was a mistake or want to ask us to review it.',
	],
	unblacklist: [
		'The block on your Santa Shop email was removed',
		'This email address is no longer blocked from future registrations. This did not restore a canceled registration or turn sign-in back on. Please reply if you need help accessing your account.',
	],
};

const spanish: Record<ReviewEmailAction, readonly [string, string]> = {
	contact: [
		'Confirme su inscripción para Santa Shop',
		'Encontramos dos inscripciones que podrían incluir a algunos de los mismos niños. Responda para decirnos cuál inscripción debemos mantener, o cancele la inscripción adicional si puede. No hemos cambiado su inscripción.',
	],
	editChild: [
		'Actualizamos los datos de un menor en su inscripción para Santa Shop',
		'Actualizamos los datos de un menor en su inscripción. Responda si todavía hay algo que corregir.',
	],
	removeChild: [
		'Retiramos a un menor de su inscripción para Santa Shop',
		'Un menor ya no está incluido en su inscripción. Responda si cree que debemos corregirlo.',
	],
	restoreChild: [
		'Volvimos a incluir a un menor en su inscripción para Santa Shop',
		'Volvimos a incluir a un menor en su inscripción. Responda si todavía hay algo que corregir.',
	],
	disable: [
		'Información sobre su acceso a Santa Shop',
		'Suspendimos temporalmente el acceso a su cuenta. No cancelamos su inscripción ni liberamos su cita. Responda si cree que fue un error o necesita ayuda.',
	],
	enable: [
		'Restauramos su acceso a Santa Shop',
		'Ya puede volver a usar su cuenta. Esto no cambió su inscripción ni su cita.',
	],
	cancel: [
		'Se canceló su inscripción para Santa Shop',
		'Se canceló su inscripción y su cita ya no está reservada. No use la confirmación anterior para registrarse al llegar. Responda si cree que fue un error o necesita ayuda.',
	],
	reinstate: [
		'Restauramos su inscripción para Santa Shop',
		'Restauramos su inscripción con su cita original. Abra su inscripción para ver la confirmación actual que debe presentar al llegar.',
	],
	blacklist: [
		'Información sobre su correo electrónico de Santa Shop',
		'Esta dirección de correo no se puede usar para inscripciones en Santa Shop, incluso para eventos futuros. Responda si cree que fue un error o quiere solicitar una revisión.',
	],
	unblacklist: [
		'Quitamos el bloqueo de su correo electrónico de Santa Shop',
		'Esta dirección de correo ya no está bloqueada para futuras inscripciones. Esto no restauró una inscripción cancelada ni volvió a activar el inicio de sesión. Responda si necesita ayuda para acceder a su cuenta.',
	],
};

export interface ReviewMessage {
	readonly subject: string;
	readonly paragraphs: readonly string[];
	readonly text: string;
	readonly html: string;
	readonly replyTo: typeof REVIEW_REPLY_TO;
}

export function renderReviewEmail(
	action: ReviewEmailAction,
	language: Language,
	firstName: string,
	customMessage: string,
): ReviewMessage {
	const translated = language === 'es';
	const [subject, body] = (translated ? spanish : english)[action];
	const salutation = translated ? 'Hola' : 'Hello';
	const name = firstName.trim();
	const paragraphs = [
		name ? salutation + ' ' + name + ',' : salutation + ',',
		body,
		...(customMessage.trim() ? [customMessage.trim()] : []),
		'Denver Santa Claus Shop',
	];
	return {
		subject,
		paragraphs,
		text: paragraphs.join('\n\n'),
		html:
			'<div style="font-family:Arial,sans-serif;line-height:1.6">' +
			paragraphs
				.map(
					(paragraph) =>
						'<p>' +
						escapeEmailHtml(paragraph).replace(/\r?\n/gu, '<br>') +
						'</p>',
				)
				.join('') +
			'</div>',
		replyTo: REVIEW_REPLY_TO,
	};
}
