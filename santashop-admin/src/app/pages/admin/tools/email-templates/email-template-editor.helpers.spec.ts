import { describe, expect, it } from 'vitest';
import {
	extractHandlebarsFieldNames,
	mergeTemplateFieldDefinitions,
	renderEmailTemplatePreview,
} from './email-template-editor.helpers';

describe('email template editor helpers', () => {
	it('extracts unique handlebars paths in encounter order', () => {
		expect(
			extractHandlebarsFieldNames(
				'<p>{{ firstName }} {{contact.firstName}} {{firstName}}</p>',
			),
		).toEqual(['firstName', 'contact.firstName']);
	});

	it('merges detected fields, preserves configured values, and adds an implicit QR image field', () => {
		const result = mergeTemplateFieldDefinitions(
			'<img alt="Guest QR code" src="{{qrCodeUrl}}"><p>{{contact.firstName}}</p>',
			'Welcome {{eventName}}',
			[
				{
					name: 'eventName',
					mapping: 'event.title',
					sampleValue: 'Toy Drive',
					description: 'The event title',
				},
			],
		);

		expect(result).toEqual([
			{
				name: 'qrCodeUrl',
				mapping: 'qrCodeUrl',
				sampleValue: 'https://example.com/qr-code.png',
			},
			{
				name: 'contact.firstName',
				mapping: 'contact.firstName',
				sampleValue: 'Sample First Name',
			},
			{
				name: 'eventName',
				mapping: 'event.title',
				sampleValue: 'Toy Drive',
				description: 'The event title',
			},
		]);
	});

	it('renders nested mappings and uses a field sample when its mapping has no value', () => {
		expect(
			renderEmailTemplatePreview('<p>{{firstName}} / {{contact.lastName}}</p>', [
				{
					name: 'contact.firstName',
					mapping: 'contact.firstName',
					sampleValue: 'Buddy',
				},
				{
					name: 'firstName',
					mapping: 'firstName',
					sampleValue: 'Fallback',
				},
				{
					name: 'contact.lastName',
					mapping: 'contact.lastName',
					sampleValue: 'Elf',
				},
			]),
		).toBe('<p>Fallback / Elf</p>');
	});

	it('returns a safe error document when Handlebars cannot compile the draft', () => {
		expect(renderEmailTemplatePreview('{{#if firstName}}', [])).toContain(
			'<pre>',
		);
	});
});
