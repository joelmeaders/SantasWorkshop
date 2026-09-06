export type CustomerLanguage = 'en' | 'es';

export const isCustomerLanguage = (value: unknown): value is CustomerLanguage =>
	value === 'en' || value === 'es';

export const customerLanguageOrEnglish = (value: unknown): CustomerLanguage =>
	value === 'es' ? 'es' : 'en';

export interface UpdatePreferredLanguageRequest {
	preferredLanguage: CustomerLanguage;
}
