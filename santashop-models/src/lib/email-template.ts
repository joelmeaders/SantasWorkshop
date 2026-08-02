export const EMAIL_TEMPLATE_KEYS = {
	registrationConfirmation: 'registration-confirmation',
	eventReminder: 'event-reminder',
} as const;

export type BuiltInEmailTemplateKey =
	(typeof EMAIL_TEMPLATE_KEYS)[keyof typeof EMAIL_TEMPLATE_KEYS];

export const EMAIL_TEMPLATE_DELIVERY_PROFILES = {
	registrationConfirmation: EMAIL_TEMPLATE_KEYS.registrationConfirmation,
	eventReminder: EMAIL_TEMPLATE_KEYS.eventReminder,
} as const;

export type EmailTemplateDeliveryProfile =
	(typeof EMAIL_TEMPLATE_DELIVERY_PROFILES)[keyof typeof EMAIL_TEMPLATE_DELIVERY_PROFILES];

export const EMAIL_TEMPLATE_RUNTIME_FIELDS: Readonly<
	Record<EmailTemplateDeliveryProfile, readonly string[]>
> = {
	[EMAIL_TEMPLATE_DELIVERY_PROFILES.registrationConfirmation]: [
		'firstName',
		'eventName',
		'qrCodeUrl',
		'code',
		'dateTime',
	],
	[EMAIL_TEMPLATE_DELIVERY_PROFILES.eventReminder]: [
		'firstName',
		'eventName',
		'qrCodeUrl',
		'code',
		'dateTime',
	],
} as const;

export interface EmailTemplateFieldDefinition {
	name: string;
	mapping: string;
	sampleValue: string;
	description?: string;
}

export interface EmailTemplateSummary {
	key: string;
	deliveryProfile: EmailTemplateDeliveryProfile;
	displayName: string;
	description?: string;
	subjectPart: string;
	awsTemplateName: string;
	fieldMappings: EmailTemplateFieldDefinition[];
	currentRevisionId?: string;
	currentRevisionNumber?: number;
	publishedRevisionId?: string;
	publishedRevisionNumber?: number;
	publishedOn?: false | Date;
	createdOn: Date;
	updatedOn: Date;
}

export interface EmailTemplateRevision {
	id: string;
	templateKey: string;
	deliveryProfile: EmailTemplateDeliveryProfile;
	revisionNumber: number;
	subjectPart: string;
	htmlStoragePath: string;
	htmlFileName: string;
	fieldMappings: EmailTemplateFieldDefinition[];
	notes?: string;
	createdOn: Date;
	createdByUid?: string;
	createdByEmail?: string;
	publishedOn?: false | Date;
}

export interface EmailTemplateDetail {
	template: EmailTemplateSummary;
	revisions: EmailTemplateRevision[];
	currentHtml?: string;
}

export interface GetEmailTemplateRequest {
	key: string;
}

export interface GetEmailTemplateRevisionRequest {
	key: string;
	revisionId: string;
}

export interface GetEmailTemplateRevisionResponse {
	template: EmailTemplateSummary;
	revision: EmailTemplateRevision;
	html: string;
}

export interface SaveEmailTemplateRevisionRequest {
	key: string;
	deliveryProfile: EmailTemplateDeliveryProfile;
	displayName: string;
	description?: string;
	awsTemplateName: string;
	subjectPart: string;
	html: string;
	fieldMappings: EmailTemplateFieldDefinition[];
	notes?: string;
}

export interface SaveEmailTemplateRevisionResponse {
	template: EmailTemplateSummary;
	revision: EmailTemplateRevision;
	html: string;
}

export interface DeleteEmailTemplateRequest {
	key: string;
}

export interface PublishEmailTemplateRequest {
	key: string;
	revisionId?: string;
}

export interface PublishEmailTemplateResponse {
	template: EmailTemplateSummary;
	revision: EmailTemplateRevision;
	renderedHtml: string;
}

export interface SendTestEmailTemplateRequest {
	recipientEmail: string;
	deliveryProfile: EmailTemplateDeliveryProfile;
	subjectPart: string;
	html: string;
	fieldMappings: EmailTemplateFieldDefinition[];
}

export interface SendTestEmailTemplateResponse {
	recipientEmail: string;
	renderedSubject: string;
	renderedHtml: string;
}

export interface SendTestEmailTemplateRequest {
	recipientEmail: string;
	deliveryProfile: EmailTemplateDeliveryProfile;
	subjectPart: string;
	html: string;
	fieldMappings: EmailTemplateFieldDefinition[];
}

export interface SendTestEmailTemplateResponse {
	recipientEmail: string;
	renderedSubject: string;
	renderedHtml: string;
}
