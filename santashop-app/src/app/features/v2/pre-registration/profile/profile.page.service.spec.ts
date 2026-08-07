import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import {
	AnalyticsWrapper,
	AuthService,
	ErrorHandlerService,
	FireRepoLite,
	FunctionsWrapper,
} from '@santashop/core';
import type { User } from '@santashop/models';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePageService } from './profile.page.service';

describe('ProfilePageService', () => {
	const currentUser$ = new Subject<{ uid: string } | null>();
	const read = vi.fn();
	const collection = vi.fn().mockReturnValue({ read });

	beforeEach(() => {
		read.mockReset();
		collection.mockClear();
		TestBed.configureTestingModule({
			providers: [
				ProfilePageService,
				{ provide: AuthService, useValue: { currentUser$ } },
				{ provide: FireRepoLite, useValue: { collection } },
				{ provide: FunctionsWrapper, useValue: {} },
				{ provide: ErrorHandlerService, useValue: {} },
				{ provide: AlertController, useValue: {} },
				{ provide: LoadingController, useValue: {} },
				{ provide: Router, useValue: {} },
				{ provide: TranslateService, useValue: {} },
				{ provide: AnalyticsWrapper, useValue: {} },
			],
		});
	});

	it('ignores signed-out auth emissions and loads the next authenticated profile', () => {
		const profile = {
			uid: 'customer-1',
			firstName: 'Holly',
			lastName: 'Jolly',
			zipCode: '80202',
		} as User;
		read.mockReturnValue(of(profile));

		const service = TestBed.inject(ProfilePageService);

		expect(() => currentUser$.next(null)).not.toThrow();
		expect(collection).not.toHaveBeenCalled();

		currentUser$.next({ uid: 'customer-1' });

		expect(read).toHaveBeenCalledWith('customer-1');
		expect(service.profileForm.value).toMatchObject({
			firstName: 'Holly',
			lastName: 'Jolly',
			zipCode: 80202,
		});
	});
});
