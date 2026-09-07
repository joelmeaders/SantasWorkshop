import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppUpdatePromptComponent } from './app-update-prompt.component';
import {
	AppUpdateNotice,
	AppUpdateService,
} from '../services/app-update.service';

describe('AppUpdatePromptComponent', () => {
	let fixture: ComponentFixture<AppUpdatePromptComponent>;
	let notice: WritableSignal<AppUpdateNotice>;
	const dismiss = vi.fn();
	const reload = vi.fn();

	beforeEach(async () => {
		notice = signal<AppUpdateNotice>('ready');
		dismiss.mockReset();
		reload.mockReset();
		await TestBed.configureTestingModule({
			imports: [AppUpdatePromptComponent],
			providers: [
				{
					provide: AppUpdateService,
					useValue: {
						isEnabled: true,
						notice: notice.asReadonly(),
						dismiss,
						reload,
					},
				},
			],
		}).compileComponents();
		fixture = TestBed.createComponent(AppUpdatePromptComponent);
		fixture.detectChanges();
	});

	it('renders an accessible ready prompt with refresh and dismiss actions', () => {
		const prompt = fixture.nativeElement.querySelector(
			'[role="status"]',
		) as HTMLElement;

		expect(prompt).toBeTruthy();
		expect(prompt.textContent).toContain('A fresh update is ready');
		expect(prompt.textContent).toContain(
			'You can keep going and update later.',
		);
		expect(prompt.textContent).toContain(
			'Refreshing now may erase information you have not saved.',
		);
		expect(
			fixture.nativeElement.querySelector('button.primary').textContent,
		).toContain('Refresh page');
		expect(
			fixture.nativeElement.querySelector('button:not(.primary)')
				.textContent,
		).toContain('Not now');
		expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(
			2,
		);
	});

	it('keeps the current flow when Not now is selected', () => {
		const later = fixture.nativeElement.querySelector(
			'button:not(.primary)',
		) as HTMLButtonElement;
		later.click();

		expect(dismiss).toHaveBeenCalledOnce();
		expect(reload).not.toHaveBeenCalled();
	});

	it('reloads only when Refresh page is selected', () => {
		const reloadButton = fixture.nativeElement.querySelector(
			'button.primary',
		) as HTMLButtonElement;
		reloadButton.click();

		expect(reload).toHaveBeenCalledOnce();
		expect(dismiss).not.toHaveBeenCalled();
	});

	it('explains that customers can continue after an update fails', () => {
		notice.set('failed');
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain(
			'The update will have to wait',
		);
		expect(fixture.nativeElement.textContent).toContain(
			'You can keep using the site and try refreshing later.',
		);
		expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(
			2,
		);
	});

	it('offers only refresh for an unrecoverable state', () => {
		notice.set('unrecoverable');
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(
			1,
		);
		expect(fixture.nativeElement.textContent).toContain(
			'Please refresh to continue',
		);
	});
});
