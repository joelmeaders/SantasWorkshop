import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PopoverController } from '@ionic/angular';
import {
	createPopoverControllerMock,
	provideAuthMock,
	provideFunctionsMock,
} from '../../../../test-helpers';
import { InternalHeaderComponent } from './internal-header.component';

describe('InternalHeaderComponent', () => {
	let component: InternalHeaderComponent;
	let fixture: ComponentFixture<InternalHeaderComponent>;

	beforeEach(async () => {
		TestBed.configureTestingModule({
			imports: [InternalHeaderComponent],
			providers: [
				provideAuthMock(),
				provideFunctionsMock(),
				{
					provide: PopoverController,
					useValue: createPopoverControllerMock(),
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(InternalHeaderComponent);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
