import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminPage } from './admin.page';
import {
	provideFirestoreWrapperMock,
	provideAuthMock,
	providePublicParametersSourceMock,
} from '../../../test-helpers';
import { provideRouter } from '@angular/router';

describe('AdminPage', () => {
	let component: AdminPage;
	let fixture: ComponentFixture<AdminPage>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [AdminPage],
			providers: [
				provideFirestoreWrapperMock(),
				provideAuthMock(),
				providePublicParametersSourceMock(),
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
});
