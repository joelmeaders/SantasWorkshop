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
				'<p>{{ firstName }} {{recipient.firstName}} {{firstName}}</p>',
			),
		).toEqual(['firstName', 'recipient.firstName']);
	});

	it('merges detected fields, preserves configured values, and detects explicit QR placeholders', () => {
		const result = mergeTemplateFieldDefinitions(
			'<img alt="Guest QR code" src="{{qrCodeUrl}}"><p>{{recipient.firstName}}</p>',
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
				name: 'recipient.firstName',
				mapping: 'recipient.firstName',
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
			renderEmailTemplatePreview(
				'<p>{{firstName}} / {{contact.lastName}}</p>',
				[
					{
						name: 'recipient.firstName',
						mapping: 'recipient.firstName',
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
				],
			),
		).toBe('<p>Fallback / Elf</p>');
	});

	it('renders plain fields without dynamic compilation', () => {
		expect(
			renderEmailTemplatePreview(
				'<p>{{firstName}}</p><img src="{{qrCodeUrl}}">',
				[
					{
						name: 'firstName',
						mapping: 'firstName',
						sampleValue: '<Buddy & friends>',
					},
					{
						name: 'qrCodeUrl',
						mapping: 'qrCodeUrl',
						sampleValue: '',
					},
				],
			),
		).toBe('<p><Buddy & friends></p><img src="">');
	});

	it('does not treat helper syntax as plain fields', () => {
		expect(
			extractHandlebarsFieldNames(
				'{{#if qrCodeUrl}}<img src="{{qrCodeUrl}}">{{/if}}',
			),
		).toEqual(['qrCodeUrl']);
		expect(
			extractHandlebarsFieldNames('{{#if firstName}}{{code}}{{/if}}'),
		).toEqual(['code']);
	});

	it('rejects conditional blocks in the browser preview', () => {
		expect(
			renderEmailTemplatePreview(
				'{{#if firstName}}{{#unless code}}Code pending{{else}}Code: {{code}}{{/unless}}{{else}}No name{{/if}}',
				[
					{
						name: 'firstName',
						mapping: 'firstName',
						sampleValue: 'Buddy',
					},
					{
						name: 'code',
						mapping: 'code',
						sampleValue: '',
					},
				],
			),
		).toContain(
			'<pre>Only plain Handlebars placeholders like {{field}} are supported.</pre>',
		);
	});

	it('rejects else-if branches and raw interpolation', () => {
		expect(
			renderEmailTemplatePreview(
				'{{#if firstName}}Name{{else if code}}Code: {{& code}}{{else}}Empty{{/if}}',
				[
					{
						name: 'firstName',
						mapping: 'firstName',
						sampleValue: '',
					},
					{
						name: 'code',
						mapping: 'code',
						sampleValue: '<ABC>',
					},
				],
			),
		).toContain(
			'<pre>Only plain Handlebars placeholders like {{field}} are supported.</pre>',
		);
	});

	it('returns a safe error document when Handlebars cannot compile the draft', () => {
		expect(renderEmailTemplatePreview('{{#if firstName}}', [])).toContain(
			'<pre>',
		);
	});

	it('reports unsupported helpers inside the preview document', () => {
		expect(
			renderEmailTemplatePreview(
				'{{#each firstName}}{{this}}{{/each}}',
				[],
			),
		).toContain(
			'<pre>Only plain Handlebars placeholders like {{field}} are supported.</pre>',
		);
	});

	it('rejects triple and raw interpolation syntax', () => {
		expect(renderEmailTemplatePreview('{{{firstName}}}', [])).toContain(
			'<pre>Only plain Handlebars placeholders like {{field}} are supported.</pre>',
		);
		expect(renderEmailTemplatePreview('{{& firstName}}', [])).toContain(
			'<pre>Only plain Handlebars placeholders like {{field}} are supported.</pre>',
		);
		expect(renderEmailTemplatePreview('{{firstName}}}', [])).toContain(
			'<pre>Only plain Handlebars placeholders like {{field}} are supported.</pre>',
		);
		expect(renderEmailTemplatePreview('}}', [])).toContain(
			'<pre>Only plain Handlebars placeholders like {{field}} are supported.</pre>',
		);
	});
});
