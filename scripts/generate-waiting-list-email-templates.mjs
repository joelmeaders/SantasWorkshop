import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(
	new URL(
		'../santashop-admin/src/assets/email-templates/2026/',
		import.meta.url,
	),
);
mkdirSync(output, { recursive: true });
const copies = {
	en: {
		title: 'More appointment times are open!',
		greeting: 'Hello {{firstName}},',
		intro:
			'We added more spots at the Denver Santa Claus Shop. These spots will fill very fast. Visit the site now to choose a date and time and finish your registration.',
		notice: 'This email does not save a spot for you.',
		button: 'Choose a date and time',
		manage: 'Manage waiting list emails',
		footer:
			'You received this email because you joined our waiting list. You can leave the list at any time.',
		team: 'Your Denver Santa Claus Shop volunteers',
		logo: 'Denver Santa Claus Shop',
	},
	es: {
		title: '¡Hay más horarios disponibles!',
		greeting: 'Hola {{firstName}}:',
		intro:
			'Agregamos más lugares en Denver Santa Claus Shop. Se llenarán muy rápido. Entra al sitio ahora para elegir una fecha y hora y terminar tu registro.',
		notice: 'Este correo no reserva un lugar para ti.',
		button: 'Elegir fecha y hora',
		manage: 'Administrar correos de la lista de espera',
		footer:
			'Recibiste este correo porque te uniste a nuestra lista de espera. Puedes salir de la lista en cualquier momento.',
		team: 'Tus voluntarios de Denver Santa Claus Shop',
		logo: 'Denver Santa Claus Shop',
	},
};
for (const [language, copy] of Object.entries(copies)) {
	const html = `<!DOCTYPE html><html lang="${language}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy.title}</title></head>
<body style="margin:0;padding:0;background:#f5f0e8;color:#263d35;font-family:Arial,Helvetica,sans-serif;word-wrap:break-word">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f0e8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td align="center" style="padding:28px;background:#173e32"><img src="https://storage.googleapis.com/santas-workshop-193b5.appspot.com/public/dscs_logo_email.png" width="190" alt="${copy.logo}" style="display:block;max-width:100%;height:auto;color:white"><p style="margin:20px 0 0;color:#fff;font-size:16px;font-weight:bold">Denver Santa Claus Shop</p></td></tr>
<tr><td style="padding:32px 28px"><h1 style="margin:0 0 24px;color:#a82b32;font-size:30px;line-height:1.2">${copy.title}</h1><p style="font-size:18px;line-height:1.6">${copy.greeting}</p><p style="font-size:18px;line-height:1.6">${copy.intro}</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0"><tr><td style="background:#a82b32;border-radius:8px;text-align:center"><a href="{{registrationUrl}}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:17px 24px;color:#fff;text-decoration:none;font-size:18px;font-weight:bold">${copy.button}</a></td></tr></table>
<p style="padding:18px;background:#f7f0de;border-left:4px solid #c09a39;font-size:17px;line-height:1.5">${copy.notice}</p><p style="font-size:16px;line-height:1.6">${copy.team}</p></td></tr>
<tr><td style="padding:24px 28px;background:#edf2ed;font-size:14px;line-height:1.6"><p>${copy.footer}</p><a href="{{waitingListUrl}}" target="_blank" rel="noopener noreferrer" style="color:#173e32;text-decoration:underline">${copy.manage}</a></td></tr></table></td></tr></table></body></html>`;
	const samples = {
		firstName: language === 'es' ? 'María' : 'Alex',
		registrationUrl:
			'https://register.denversantaclausshop.org/pre-registration/overview',
		waitingListUrl:
			'https://register.denversantaclausshop.org/?mode=sign-in&waitingList=manage',
	};
	const template = {
		key: `waiting-list-capacity-2026-${language}`,
		deliveryProfile: 'waiting-list-capacity',
		displayName: `Waiting list capacity · ${language === 'es' ? 'Español' : 'English'}`,
		language,
		awsTemplateName: `waiting-list-capacity-2026-${language}`,
		subjectPart: copy.title,
		html,
		textPart: `${copy.greeting}\n\n${copy.intro}\n\n${copy.button}: {{registrationUrl}}\n\n${copy.notice}\n\n${copy.team}\n\n${copy.footer}\n${copy.manage}: {{waitingListUrl}}`,
		seasonalReviewRequired: false,
		fieldMappings: Object.entries(samples).map(([name, sampleValue]) => ({
			name,
			mapping: name,
			sampleValue,
		})),
	};
	writeFileSync(
		`${output}/waiting-list-capacity-2026-${language}.json`,
		JSON.stringify(
			{ format: 'santashop-email-template', version: 1, template },
			null,
			'\t',
		) + '\n',
	);
}
