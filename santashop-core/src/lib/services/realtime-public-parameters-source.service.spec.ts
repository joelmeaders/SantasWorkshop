import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { FireRepoLite } from './fire-repo-lite.service';
import { RealtimePublicParametersSource } from './realtime-public-parameters-source.service';

describe('RealtimePublicParametersSource', () => {
	it('reads parameters/public through the realtime repository', () => {
		const publicParameters$ = of(undefined);
		const read = vi.fn().mockReturnValue(publicParameters$);
		const collection = vi.fn().mockReturnValue({ read });
		TestBed.configureTestingModule({
			providers: [
				RealtimePublicParametersSource,
				{ provide: FireRepoLite, useValue: { collection } },
			],
		});

		const source = TestBed.inject(RealtimePublicParametersSource);

		expect(source.publicParameters$).toBe(publicParameters$);
		expect(collection).toHaveBeenCalledWith('parameters');
		expect(read).toHaveBeenCalledWith('public');
	});
});
