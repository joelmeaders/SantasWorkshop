import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminPage } from './admin.page';
import {
	provideFirestoreWrapperMock,
	provideAuthMock,
	providePublicParametersSourceMock,
} from '../../../test-helpers';
import { AuthService } from '@santashop/core/admin/firestore';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

describe('AdminPage', () => {
	let component: AdminPage;
	let fixture: ComponentFixture<AdminPage>;
	let isAdmin$: BehaviorSubject<boolean>;

	beforeEach(async () => {
		isAdmin$ = new BehaviorSubject(true);
		TestBed.configureTestingModule({
			imports: [AdminPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideAuthMock(),
				providePublicParametersSourceMock(),
				{
					provide: AuthService,
					useValue: { isAdmin$: isAdmin$.asObservable() },
				},
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(AdminPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('hides the registration tab for check-in-only users', async () => {
		isAdmin$.next(false);
		await fixture.whenStable();
		await fixture.whenStable();

		expect(
			fixture.nativeElement.querySelector('#onSiteRegistrationTab'),
		).toBeNull();
	});
});
