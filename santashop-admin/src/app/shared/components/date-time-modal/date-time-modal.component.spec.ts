import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateTimeModalComponent } from './date-time-modal.component';
import { testHelpers } from '../../../../test-helpers';

describe('DateTimeModalComponent', () => {
	let component: DateTimeModalComponent;
	let fixture: ComponentFixture<DateTimeModalComponent>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [DateTimeModalComponent],
			providers: [...testHelpers],
		}).compileComponents();

		fixture = TestBed.createComponent(DateTimeModalComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
