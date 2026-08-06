import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideTranslateServiceMock } from '../../../../../../test-helpers';
import { SubmitCardComponent } from './submit-card.component';

describe('SubmitCardComponent', () => {
	let component: SubmitCardComponent;
	let fixture: ComponentFixture<SubmitCardComponent>;

	beforeEach(async (): Promise<void> => {
		await TestBed.configureTestingModule({
			imports: [SubmitCardComponent],
			providers: [
				provideTranslateServiceMock(),
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: { paramMap: { get: (): null => null } },
					},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(SubmitCardComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('emits a validated email update request', () => {
		const request = jasmine.createSpy('request');
		component.emailUpdateRequested.subscribe(request);
		component.changeEmailForm.setValue({
			emailAddress: 'updated@example.com',
			password: 'current-password',
		});

		component.updateEmail();

		expect(request).toHaveBeenCalledWith({
			emailAddress: 'updated@example.com',
			password: 'current-password',
		});
	});
});
