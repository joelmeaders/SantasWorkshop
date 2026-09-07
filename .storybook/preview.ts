import type { Preview } from '@storybook/angular-vite';
import { Chart } from 'chart.js';

import '@ionic/angular/css/core.css';
import '@ionic/angular/css/normalize.css';
import '@ionic/angular/css/structure.css';
import '@ionic/angular/css/typography.css';
import '@ionic/angular/css/display.css';
import '@ionic/angular/css/padding.css';
import '@ionic/angular/css/float-elements.css';
import '@ionic/angular/css/text-alignment.css';
import '@ionic/angular/css/text-transformation.css';
import '@ionic/angular/css/flex-utils.css';
import './layout.css';

import adminGlobalStyles from '../santashop-admin/src/global.scss?inline';
import adminThemeStyles from '../santashop-admin/src/theme/variables.scss?inline';
import customerGlobalStyles from '../santashop-app/src/global.scss?inline';
import customerThemeStyles from '../santashop-app/src/theme/variables.scss?inline';

import { installStoryAudit, verifyStoryAudit } from './story-audit';

// Canvas animations use Date.now(). Visual tests freeze it for stable fixtures.
Chart.defaults.animation = false;

const themeStyleId = 'santashop-storybook-theme';

const viewports = {
	mobile: {
		name: 'Mobile (390 x 844)',
		styles: { width: '390px', height: '844px' },
		type: 'mobile' as const,
	},
	tablet: {
		name: 'Tablet (834 x 1112)',
		styles: { width: '834px', height: '1112px' },
		type: 'tablet' as const,
	},
	desktop: {
		name: 'Desktop (1440 x 900)',
		styles: { width: '1440px', height: '900px' },
		type: 'desktop' as const,
	},
};

function applyTheme(title: string, fileName: unknown): void {
	const sourceFile =
		typeof fileName === 'string' ? fileName.replaceAll('\\', '/') : '';
	const isAdminStory =
		title.startsWith('Admin/') || sourceFile.includes('/santashop-admin/');
	const style =
		document.getElementById(themeStyleId) ??
		document.createElement('style');

	style.id = themeStyleId;
	style.textContent = isAdminStory
		? `${adminThemeStyles}\n${adminGlobalStyles}`
		: `${customerThemeStyles}\n${customerGlobalStyles}`;

	if (!style.parentElement) {
		document.head.append(style);
	}

	document.documentElement.dataset['santashopApp'] = isAdminStory
		? 'admin'
		: 'registration';
}

const preview: Preview = {
	tags: ['autodocs'],
	parameters: {
		a11y: {
			test: 'error',
			options: {
				runOnly: [
					'wcag2a',
					'wcag2aa',
					'wcag21a',
					'wcag21aa',
					'wcag22a',
					'wcag22aa',
					'best-practice',
				],
			},
		},
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
		docs: {
			story: { inline: false },
		},
		layout: 'fullscreen',
		options: {
			storySort: {
				order: ['Guide', 'Registration', 'Admin'],
			},
		},
		viewport: {
			options: viewports,
		},
	},
	initialGlobals: {
		viewport: { value: 'desktop', isRotated: false },
	},
	decorators: [
		(story, context): ReturnType<typeof story> => {
			applyTheme(context.title, context.parameters['fileName']);
			return story();
		},
	],
	beforeEach: async ({ canvasElement }) => {
		delete canvasElement.dataset['storyAudit'];
		canvasElement.classList.add('santashop-story-canvas');
		const restoreAudit = installStoryAudit();
		return (): void => {
			restoreAudit();
			delete canvasElement.dataset['storyAudit'];
			canvasElement.classList.remove('santashop-story-canvas');
		};
	},
	afterEach: async ({ canvasElement }) => {
		verifyStoryAudit(canvasElement);
		canvasElement.dataset['storyAudit'] = 'passed';
	},
};

export default preview;
