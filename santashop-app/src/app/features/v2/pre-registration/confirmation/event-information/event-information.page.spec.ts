import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideTranslateServiceMock } from '../../../../../../test-helpers';
import { EventInformationPage } from './event-information.page';

describe('EventInformationPage', () => {
	let component: EventInformationPage;
	let fixture: ComponentFixture<EventInformationPage>;

	beforeEach(waitForAsync(async (): Promise<void> => {
		await TestBed.configureTestingModule({
			imports: [EventInformationPage],
			providers: [
				{
					provide: ActivatedRoute,
					useValue: {
						snapshot: { paramMap: { get: (): null => null } },
					},
				},
				provideTranslateServiceMock(),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(EventInformationPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	}));

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
