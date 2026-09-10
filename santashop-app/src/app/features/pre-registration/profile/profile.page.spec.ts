import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { mockUsers } from '../../../../../../test-helpers/mock-data';
import { provideTranslateServiceMock } from '../../../../test-helpers';
import { ProfilePage } from './profile.page';
import { ProfilePageService } from './profile.page.service';
import { changeEmailForm, changePasswordForm } from './profile.form';
import { newChangeInfoForm } from './change-info/change-info.form';

const createProfileFixture = (): Pick<
	ProfilePageService,
	| 'profileForm'
	| 'changeEmailForm'
	| 'changePasswordForm'
	| 'updatePublicProfile'
	| 'changeEmailAddress'
	| 'changePassword'
> & {
	userProfile$: BehaviorSubject<ReturnType<typeof mockUsers>['user1']>;
} => ({
	profileForm: newChangeInfoForm(),
	changeEmailForm: changeEmailForm(),
	changePasswordForm: changePasswordForm(),
	userProfile$: new BehaviorSubject(mockUsers().user1),
	updatePublicProfile: vi
		.fn<ProfilePageService['updatePublicProfile']>()
		.mockResolvedValue(undefined),
	changeEmailAddress: vi
		.fn<ProfilePageService['changeEmailAddress']>()
		.mockResolvedValue(undefined),
	changePassword: vi
		.fn<ProfilePageService['changePassword']>()
		.mockResolvedValue(undefined),
});

describe('ProfilePage', () => {
	let fixture: ComponentFixture<ProfilePage>;
	let service: ReturnType<typeof createProfileFixture>;
	beforeEach(async () => {
		service = createProfileFixture();
		await TestBed.configureTestingModule({
			imports: [ProfilePage],
			providers: [
				{ provide: ProfilePageService, useValue: service },
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: { paramMap: { get: (): null => null } },
					},
				},
				provideTranslateServiceMock(),
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ProfilePage);
		await fixture.whenStable();
	});

	it('renders the three account forms and updates the visible profile', async () => {
		expect(
			fixture.nativeElement.querySelectorAll('.settings-panel'),
		).toHaveLength(3);
		expect(fixture.nativeElement.querySelectorAll('form')).toHaveLength(3);
		expect(fixture.nativeElement.textContent).toContain('Jesse Doe');
		service.userProfile$.next({
			...mockUsers().user1,
			firstName: 'Another',
			lastName: 'Family',
		});
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain('Another Family');
		expect(fixture.nativeElement.textContent).not.toContain('Jesse Doe');
	});

	it.each([
		['updateProfile', 'updatePublicProfile'],
		['changeEmailAddress', 'changeEmailAddress'],
		['changePassword', 'changePassword'],
	] as const)(
		'routes %s to its account action',
		async (pageAction, serviceAction) => {
			await fixture.componentInstance[pageAction]();
			expect(service[serviceAction]).toHaveBeenCalledOnce();
		},
	);
});
