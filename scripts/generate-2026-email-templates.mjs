import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(
	new URL('../santashop-functions/package.json', import.meta.url),
);
const previewQr = await require('qrcode').toDataURL('PREVIEW-ONLY-JOY26ABC', {
	width: 432,
	margin: 4,
});
import { fileURLToPath } from 'node:url';

// Historical content: 0b53b93^:santashop-functions/src/utility/assets/reg-conf-email.json.
// Keep the six editable artifacts reproducible without introducing another runtime.
const output = fileURLToPath(
	new URL(
		'../santashop-admin/src/assets/email-templates/2026/',
		import.meta.url,
	),
);
mkdirSync(output, { recursive: true });
const app = 'https://register.denversantaclausshop.org/';
const website = 'https://www.denversantaclausshop.org/';
// Original hosted DSCS logo from the 2025 email.
const logo =
	'https://storage.googleapis.com/santas-workshop-193b5.appspot.com/public/dscs_logo_email.png';
const facebook = 'https://www.facebook.com/denversantaclausshop/';
const map =
	'https://www.google.com/maps/search/?api=1&query=7150%20Leetsdale%20Drive%20Unit%20380%20Denver%20CO%2080224';
const copies = {
	en: {
		tradition: 'A Denver holiday tradition',
		mission: 'A Toy for Every Girl & Boy',
		greeting: 'Hello {{firstName}},',
		confirmation: {
			title: 'A little holiday magic.<br>A place for your family.',
			subject: 'Your {{eventName}} ticket is here',
			preview:
				'Your appointment, your ticket, and a little holiday cheer — all in one place.',
			intro: 'You’re registered for {{eventName}}! We look forward to welcoming your family and helping make the season a little brighter.',
		},
		reminder: {
			title: 'Your visit is coming up.<br>Let’s get ready for joy.',
			subject: 'A friendly reminder: your {{eventName}} visit',
			preview:
				'Keep your ticket handy. Here is everything you need for your visit.',
			intro: 'We’re getting ready to welcome you to {{eventName}}. Here’s a friendly reminder of your appointment and what to bring.',
		},
		cancellation: {
			title: 'Plans change.<br>We understand.',
			subject: 'Your {{eventName}} registration was cancelled',
			preview:
				'Your previous appointment and ticket are no longer valid. You can register again if your plans change.',
			intro: 'Your registration for {{eventName}} has been cancelled. Your previous appointment is no longer reserved, and your previous ticket and confirmation code are no longer valid.',
		},
		appointment: 'YOUR APPOINTMENT',
		previous: 'CANCELLED APPOINTMENT',
		timezone: 'Denver time · Mountain Time',
		ticket: 'Your holiday ticket',
		ticketHelp:
			'Show this QR code when you arrive. Keep the confirmation code below handy, too.',
		qrAlt: 'Your personal check-in QR code',
		code: 'CONFIRMATION CODE',
		bring: 'Three things to bring',
		items: [
			'This ticket and QR code',
			'Your photo ID',
			'Proof of each child’s age',
		],
		punctual:
			'Please arrive at your scheduled time. Need a different day or time? Update your registration in advance so we know when to welcome you.',
		manage: 'View or change registration',
		register: 'Register again',
		again: 'If you would still like to attend, sign in and complete a new registration. You’ll receive a new ticket after registering.',
		venue: 'Shop Venue',
		draft: 'DRAFT · CONFIRM 2026 DETAILS BEFORE PUBLISHING',
		venueNote: 'Shop Venue — not yet confirmed for 2026:',
		opening:
			'2026 opening date and time: TO BE CONFIRMED. Replace this note with the confirmed information before publishing.',
		map: 'View Shop Venue on map',
		faq: 'What to expect',
		help: 'A question before your visit?',
		helpText:
			'Our FAQs cover what to bring and how the Shop works. You can also contact us on Facebook.',
		faqButton: 'Read the FAQs',
		contact: 'Contact us on Facebook',
		closing: 'With warm wishes,',
		team: 'Your Denver Santa Claus Shop volunteers',
		footer: 'A little kindness. A little wonder. A season to remember.',
		site: 'Our website',
	},
	es: {
		tradition: 'Una tradición navideña de Denver',
		mission: 'Un juguete para cada niña y niño',
		greeting: 'Hola {{firstName}}:',
		confirmation: {
			title: 'Un poquito de magia.<br>Un lugar para tu familia.',
			subject: 'Tu boleto para {{eventName}} ya está aquí',
			preview:
				'Tu cita, tu boleto y un poquito de alegría navideña, en un solo lugar.',
			intro: '¡Tu inscripción para {{eventName}} está lista! Nos encantará recibir a tu familia y compartir un poco de alegría esta temporada.',
		},
		reminder: {
			title: 'Tu visita se acerca.<br>¡Preparémonos para la alegría!',
			subject: 'Te recordamos tu visita a {{eventName}}',
			preview:
				'Ten tu boleto a mano. Aquí encontrarás lo que necesitas para tu visita.',
			intro: 'Nos estamos preparando para recibirte en {{eventName}}. Te recordamos tu cita y lo que necesitas traer.',
		},
		cancellation: {
			title: 'Los planes cambian.<br>Lo entendemos.',
			subject: 'Tu inscripción para {{eventName}} fue cancelada',
			preview:
				'Tu cita y tu boleto anteriores ya no son válidos. Puedes inscribirte de nuevo si cambian tus planes.',
			intro: 'Tu inscripción para {{eventName}} fue cancelada. Tu cita anterior ya no está reservada, y tu boleto y código de confirmación anteriores ya no son válidos.',
		},
		appointment: 'TU CITA',
		previous: 'CITA CANCELADA',
		timezone: 'Hora de Denver · Hora de la Montaña',
		ticket: 'Tu boleto navideño',
		ticketHelp:
			'Muestra este código QR al llegar. Ten también a mano el código de confirmación que aparece abajo.',
		qrAlt: 'Tu código QR personal para el ingreso',
		code: 'CÓDIGO DE CONFIRMACIÓN',
		bring: 'Tres cosas que debes traer',
		items: [
			'Este boleto y código QR',
			'Tu identificación con foto',
			'Un comprobante de la edad de cada niño',
		],
		punctual:
			'Por favor, llega a la hora de tu cita. ¿Necesitas otro día u otra hora? Cambia tu inscripción con anticipación para que sepamos cuándo recibirte.',
		manage: 'Ver o cambiar mi inscripción',
		register: 'Inscribirme de nuevo',
		again: 'Si todavía deseas asistir, inicia sesión y completa una nueva inscripción. Recibirás un nuevo boleto después de inscribirte.',
		venue: 'Lugar de la tienda',
		draft: 'BORRADOR · CONFIRMAR LOS DATOS DE 2026 ANTES DE PUBLICAR',
		venueNote: 'Lugar de la tienda; aún no está confirmado para 2026:',
		opening:
			'Fecha y hora de apertura de 2026: POR CONFIRMAR. Reemplaza esta nota con la información confirmada antes de publicar.',
		map: 'Ver el lugar de la tienda en el mapa',
		faq: 'Qué puedes esperar',
		help: '¿Tienes alguna pregunta?',
		helpText:
			'En las preguntas frecuentes encontrarás qué traer y cómo funciona la tienda. También puedes contactarnos por Facebook.',
		faqButton: 'Leer las preguntas frecuentes',
		contact: 'Contactarnos por Facebook',
		closing: 'Con nuestros mejores deseos,',
		team: 'El equipo de voluntarios de Denver Santa Claus Shop',
		footer: 'Un poco de cariño. Un poco de ilusión. Una Navidad para recordar.',
		site: 'Nuestro sitio web',
	},
};

const button = (label, url) =>
	`<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#155344" style="border-radius:8px;text-align:center;mso-padding-alt:16px 24px"><a href="${url}" style="display:inline-block;padding:16px 24px;border:1px solid #155344;border-radius:8px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;line-height:1.4">${label}</a></td></tr></table>`;
const heading = (text) =>
	`<h2 style="margin:0 0 14px;color:#155344;font-size:24px;line-height:1.25;font-family:Georgia,'Times New Roman',serif">${text}</h2>`;
const paragraph = (text) =>
	`<p style="margin:0 0 18px;font-size:16px;line-height:1.7">${text}</p>`;

for (const language of ['en', 'es']) {
	const c = copies[language];
	const faq = `${website}${language === 'es' ? 'faq-espanol' : 'faq-english'}/`;
	for (const kind of ['confirmation', 'reminder', 'cancellation']) {
		const copy = c[kind];
		const cancelled = kind === 'cancellation';
		const deliveryProfile =
			kind === 'reminder' ? 'event-reminder' : `registration-${kind}`;
		const key = `${deliveryProfile}-2026-${language}`;
		const fieldNames = cancelled
			? ['firstName', 'eventName', 'dateTime']
			: ['firstName', 'eventName', 'dateTime', 'qrCodeUrl', 'code'];
		const samples = {
			firstName: language === 'es' ? 'María' : 'Jordan',
			eventName: '2026 Denver Santa Claus Shop',
			dateTime:
				language === 'es'
					? 'sábado, 12 de diciembre, 11:00 a. m.'
					: 'Saturday, December 12 at 11:00 AM',
			qrCodeUrl: previewQr,
			code: 'JOY26ABC',
		};
		const ticket = cancelled
			? ''
			: `<tr><td align="center" style="padding:28px 24px;background:#ffffff;border-bottom:2px dashed #ddccb3">${heading(c.ticket)}${paragraph(c.ticketHelp)}<img src="{{qrCodeUrl}}" width="432" height="432" alt="${c.qrAlt}" style="display:block;width:100%;height:auto;max-width:432px;margin:20px auto;background:#fff;color:#243c34;font-size:14px"><p style="font-size:11px;letter-spacing:2px;margin:12px 0 8px;color:#53645d">${c.code}</p><p style="margin:0;color:#8e233c;font:700 28px/1.4 'Courier New',monospace;letter-spacing:3px">{{code}}</p></td></tr>`;
		const body = cancelled
			? `${paragraph(c.again)}${button(c.register, app)}`
			: `${heading(c.bring)}<ol style="padding-left:24px;margin:0 0 24px;font-size:16px;line-height:1.9">${c.items.map((item) => `<li>${item}</li>`).join('')}</ol>${paragraph(c.punctual)}${button(c.manage, app)}`;
		const venue = cancelled
			? ''
			: `<tr><td class="pad" style="padding:28px 36px;background:#f6f0e6">${heading(c.venue)}<p style="color:#7b2338;font-size:12px;font-weight:bold;line-height:1.5">${c.draft}</p>${paragraph(c.venueNote)}<p style="font-size:18px;line-height:1.6;margin:0 0 12px"><strong>South Lowry Marketplace</strong><br>7150 Leetsdale Drive, Unit 380<br>Denver, CO 80224</p>${paragraph(c.opening)}<a href="${map}" style="color:#155344;font-weight:bold;line-height:1.6">${c.map}</a></td></tr>`;
		const html = `<!doctype html>
<html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy.subject}</title>
<style>@media only screen and (max-width:620px){.shell{width:100%!important}.pad{padding-left:22px!important;padding-right:22px!important}.hero-title{font-size:32px!important} }</style></head>
<body style="margin:0;padding:0;background:#eee8de;color:#243c34;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${copy.preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eee8de"><tr><td align="center" style="padding:24px 8px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" class="shell" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#fffcf6">
<tr><td align="center" bgcolor="#ffffff" style="padding:26px 22px;border-top:6px solid #bd954a;background:#ffffff"><a href="${website}" style="display:inline-block"><img src="${logo}" width="250" alt="${language === 'es' ? 'Denver Santa Claus Shop, al servicio de los niños desde 1931' : 'Denver Santa Claus Shop, serving children since 1931'}" style="display:block;width:250px;max-width:100%;height:auto;border:0;margin:0 auto 14px"></a><p style="margin:0 0 12px;color:#8e233c;font:bold italic 20px/1.4 Georgia,serif">${c.mission.replaceAll('&', '&amp;')}</p><p style="margin:0;font-size:11px;letter-spacing:1.5px;color:#53645d">${c.tradition} · 2026</p></td></tr>
<tr><td class="pad" bgcolor="#8e233c" style="padding:36px;color:#fff"><p aria-hidden="true" style="color:#edd49e;font-size:18px;letter-spacing:12px;margin:0 0 22px">✦ &nbsp; ✦ &nbsp; ✦</p><h1 class="hero-title" style="margin:0 0 24px;font:400 38px/1.15 Georgia,'Times New Roman',serif;color:#fff">${copy.title}</h1><p style="margin:0 0 12px;font-size:17px;font-weight:bold">${c.greeting}</p>${paragraph(copy.intro)}</td></tr>
<tr><td class="pad" style="padding:28px 36px;background:#155344;color:#fff"><p style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#edd49e;margin:0 0 10px">${cancelled ? c.previous : c.appointment}</p><p style="font-size:23px;line-height:1.4;margin:0 0 10px;font-weight:bold">{{dateTime}}</p><p style="font-size:13px;margin:0;color:#fff">${c.timezone}</p></td></tr>
${ticket}<tr><td class="pad" style="padding:32px 36px">${body}</td></tr>${venue}
<tr><td class="pad" style="padding:30px 36px">${heading(c.help)}${paragraph(c.helpText)}<p style="font-size:15px;line-height:2;margin:0"><a href="${faq}" style="color:#8e233c;font-weight:bold">${c.faqButton}</a><br><a href="${facebook}" style="color:#155344">${c.contact}</a></p><p style="margin:28px 0 0;line-height:1.7;font-size:15px">${c.closing}<br><strong>${c.team}</strong></p></td></tr>
<tr><td align="center" style="padding:24px;border-top:1px solid #ddccb3;color:#53645d;font-size:12px;line-height:1.8"><p style="margin:0 0 12px;font:italic 16px/1.6 Georgia,'Times New Roman',serif;color:#8e233c">${c.footer}</p><a href="${website}" style="color:#155344">${c.site}</a><br>Denver Santa Claus Shop · 2026</td></tr>
</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
		const textPart = [
			c.greeting,
			copy.intro,
			`${cancelled ? c.previous : c.appointment}\n{{dateTime}}\n${c.timezone}`,
			cancelled
				? c.again
				: `${c.ticket}\n${c.code}: {{code}}\n{{qrCodeUrl}}\n\n${c.bring}\n${c.items.map((item) => '- ' + item).join('\n')}\n\n${c.punctual}`,
			`${cancelled ? c.register : c.manage}: ${app}`,
			...(cancelled
				? []
				: [
						c.draft,
						c.venueNote +
							'\nSouth Lowry Marketplace\n7150 Leetsdale Drive, Unit 380\nDenver, CO 80224',
						c.opening,
						c.map + ': ' + map,
					]),
			c.faqButton + ': ' + faq,
			c.contact + ': ' + facebook,
			c.closing + '\n' + c.team,
			c.mission,
		].join('\n\n');
		const template = {
			key,
			deliveryProfile,
			language,
			displayName: `2026 ${kind} · ${language === 'es' ? 'Español' : 'English'}`,
			awsTemplateName: `dscs-${key}`,
			description:
				'2026 starter. Review seasonal details before publishing.',
			notes: 'Based on the 2025 email. Appointment preview is fictional.',
			subjectPart: copy.subject,
			html,
			textPart,
			seasonalReviewRequired: true,
			seasonalDetailsReviewed: false,
			fieldMappings: fieldNames.map((name) => ({
				name,
				mapping: name,
				sampleValue: samples[name],
			})),
		};
		writeFileSync(
			`${output}${key}.json`,
			JSON.stringify(
				{ format: 'santashop-email-template', version: 1, template },
				null,
				2,
			) + '\n',
		);
		writeFileSync(`${output}${key}.html`, html + '\n');
		writeFileSync(`${output}${key}.txt`, textPart + '\n');
	}
}
