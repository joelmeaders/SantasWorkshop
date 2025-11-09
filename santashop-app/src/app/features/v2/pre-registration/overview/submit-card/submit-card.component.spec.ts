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
});
