import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { expect, waitFor, within } from 'storybook/test';
import { getDebugNode, type DebugElement } from '@angular/core';
import type { SaveEmailTemplateRevisionResponse } from '@santashop/models';
import {
	adminStoryDecorators,
	enterIonicStoryPage,
} from '../../../../../../../.storybook/admin/admin-story.providers';
import { EmailTemplateEditorPage } from './email-template-editor.page';
import { EmailTemplateService } from './email-template.service';

const meta = {
	title: 'Admin/Email Templates/Template Editor',
	component: EmailTemplateEditorPage,
	decorators: adminStoryDecorators({
		routeParams: { key: 'event-reminder-2026-en' },
	}),
	parameters: {
		docs: {
			description: {
				component:
					'Complete email-template editor with SES metadata, HTML, text fallback, runtime fields, live preview, test delivery, revisions, and publishing.',
			},
		},
	},
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		const component = await enterIonicStoryPage<EmailTemplateEditorPage>(
			canvasElement,
			'admin-email-template-editor',
		);
		await expect(
			await canvas.findByText('Edit Email Template'),
		).toBeVisible();
		await expect(canvas.getByText('Revisions')).toBeVisible();
		await expect(canvas.getByText('Revision r3')).toBeVisible();
		const host = canvasElement.querySelector('admin-email-template-editor');
		if (!host) throw new Error('Email editor was not rendered');
		const service = (getDebugNode(host) as DebugElement).injector.get(
			EmailTemplateService,
		);
		const template = component.currentTemplate();
		const revision = component.revisions()[0];
		if (!template || !revision)
			throw new Error('Email revision fixture is missing');
		service.saveEmailTemplateRevision =
			async (): Promise<SaveEmailTemplateRevisionResponse> => ({
				template: {
					...template,
					currentRevisionId: 'revision-4',
					currentRevisionNumber: 4,
				},
				revision: { ...revision, id: 'revision-4', revisionNumber: 4 },
				html: component.html(),
			});
		const saveButton = canvas.getByText(
			'Save Revision',
		) as HTMLIonButtonElement;
		await waitFor(() => expect(saveButton.disabled).toBe(false));
		await component.saveRevision();
		await expect(await canvas.findByText('Revision r4')).toBeVisible();
		await component.ionViewWillEnter();
		await waitFor(() =>
			expect(canvas.queryByText('Revision r4')).not.toBeInTheDocument(),
		);
		await expect(canvas.getByText('Revision r3')).toBeVisible();
	},
} satisfies Meta<EmailTemplateEditorPage>;

export default meta;
type Story = StoryObj<EmailTemplateEditorPage>;

export const PublishedReminder: Story = {};

export const NewTemplate: Story = {
	decorators: adminStoryDecorators({ routeParams: {} }),
	play: async ({ canvasElement }): Promise<void> => {
		const canvas = within(canvasElement);
		await enterIonicStoryPage<EmailTemplateEditorPage>(
			canvasElement,
			'admin-email-template-editor',
		);
		await expect(
			await canvas.findByText('Create Email Template'),
		).toBeVisible();
		await expect(
			canvas.getByText('Save your first revision to start history.'),
		).toBeVisible();
	},
};
