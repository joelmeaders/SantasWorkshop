import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
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
	let popoverController: Mocked<PopoverController>;

	beforeEach(async () => {
		popoverController = createPopoverControllerMock();
		TestBed.configureTestingModule({
			imports: [InternalHeaderComponent],
			providers: [
				provideAuthMock(),
				provideFunctionsMock(),
				{
					provide: PopoverController,
					useValue: popoverController,
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

	it('opens the public menu from the triggering event', async (): Promise<void> => {
		const popover = { present: vi.fn().mockResolvedValue(undefined) };
		popoverController.create.mockResolvedValue(popover as never);
		const event = new Event('click');

		await component.menu(event);

		expect(popoverController.create).toHaveBeenCalledWith(
			expect.objectContaining({ event, translucent: true }),
		);
		expect(popover.present).toHaveBeenCalledOnce();
	});
});
