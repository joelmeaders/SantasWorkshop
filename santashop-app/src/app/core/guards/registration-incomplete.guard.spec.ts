import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreRegistrationService } from '../services/pre-registration.service';
import { RegistrationIncompleteGuard } from './registration-incomplete.guard';

describe('RegistrationIncompleteGuard', () => {
	beforeEach(() => TestBed.resetTestingModule());

	function setup(isComplete: boolean): {
		guard: RegistrationIncompleteGuard;
		parseUrl: ReturnType<typeof vi.fn>;
		urlTree: UrlTree;
	} {
		const urlTree = new UrlTree();
		const parseUrl = vi.fn().mockReturnValue(urlTree);

		TestBed.configureTestingModule({
			providers: [
				{
					provide: PreRegistrationService,
					useValue: { registrationComplete$: of(isComplete) },
				},
				{ provide: Router, useValue: { parseUrl } },
			],
		});

		return {
			guard: TestBed.inject(RegistrationIncompleteGuard),
			parseUrl,
			urlTree,
		};
	}

	it('allows the confirmation route after registration is complete', async () => {
		const { guard, parseUrl } = setup(true);

		await expect(firstValueFrom(guard.canActivate())).resolves.toBe(true);
		expect(parseUrl).not.toHaveBeenCalled();
	});

	it('redirects an incomplete registration to the overview', async () => {
		const { guard, parseUrl, urlTree } = setup(false);

		await expect(firstValueFrom(guard.canActivate())).resolves.toBe(urlTree);
		expect(parseUrl).toHaveBeenCalledWith('pre-registration/overview');
	});

	it('applies the same rule to child routes', async () => {
		const { guard, urlTree } = setup(false);

		await expect(firstValueFrom(guard.canActivateChild())).resolves.toBe(
			urlTree,
		);
	});
});
