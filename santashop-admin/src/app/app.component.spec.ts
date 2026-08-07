import { beforeEach, describe, expect, it } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { provideFirestoreWrapperMock } from '../test-helpers';
import { provideRouter } from '@angular/router';

describe('AppComponent', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AppComponent],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
			providers: [provideFirestoreWrapperMock(), provideRouter([])],
		}).compileComponents();
	});

	it('should create the app', () => {
		const fixture = TestBed.createComponent(AppComponent);
		const app = fixture.componentInstance;
		expect(app).toBeTruthy();
	});
});
