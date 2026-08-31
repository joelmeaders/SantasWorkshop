import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CheckinService } from '../services/checkin.service';
import { CheckedInGuard } from './checked-in.guard';

describe('CheckedInGuard', () => {
	function setup(hasCheckIn: boolean): CheckedInGuard {
		TestBed.configureTestingModule({
			providers: [
				{
					provide: CheckinService,
					useValue: { hasCheckIn$: of(hasCheckIn) },
				},
			],
		});
		return TestBed.inject(CheckedInGuard);
	}

	beforeEach(() => TestBed.resetTestingModule());

	it('allows a customer who has not checked in', async () => {
		const guard = setup(false);

		await expect(
			firstValueFrom(guard.canActivate({} as never, {} as never)),
		).resolves.toBe(true);
	});

	it('blocks a customer after check-in', async () => {
		const guard = setup(true);

		await expect(
			firstValueFrom(guard.canActivate({} as never, {} as never)),
		).resolves.toBe(false);
	});

	it('applies the same check to child routes', async () => {
		const guard = setup(true);

		await expect(
			firstValueFrom(guard.canActivateChild({} as never, {} as never)),
		).resolves.toBe(false);
	});
});
