import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DuplicatePage } from './duplicate.page';
import {
	provideFirestoreWrapperMock,
	provideAnalyticsMock,
} from '../../../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('DuplicatePage', () => {
	let component: DuplicatePage;
	let fixture: ComponentFixture<DuplicatePage>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [DuplicatePage],
			providers: [
				provideFirestoreWrapperMock(),
				provideAnalyticsMock(),
				provideRouter([]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(DuplicatePage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
