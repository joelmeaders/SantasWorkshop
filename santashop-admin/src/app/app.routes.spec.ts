import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

describe('app routes', () => {
	it('should include the schedule editor route under admin', () => {
		// Arrange
		const adminRoute = routes.find((route) => route.path === 'admin');

		// Act
		const scheduleEditorRoute = adminRoute?.children?.find(
			(route) => route.path === 'schedule-editor',
		);

		// Assert
		expect(scheduleEditorRoute).toEqual(
			expect.objectContaining({
				path: 'schedule-editor',
				title: 'DSCS: Schedule Editor',
				loadComponent: expect.any(Function),
			}),
		);
	});
});
