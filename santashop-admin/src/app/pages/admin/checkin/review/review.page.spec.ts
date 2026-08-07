import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReviewPage } from './review.page';
import {
	provideFirestoreWrapperMock,
	provideFunctionsMock,
	provideModalControllerMock,
	provideAlertControllerMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('ReviewPage', () => {
	let component: ReviewPage;
	let fixture: ComponentFixture<ReviewPage>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [ReviewPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideFunctionsMock(),
				provideModalControllerMock(),
				provideAlertControllerMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(ReviewPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
