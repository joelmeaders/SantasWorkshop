import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createModalControllerMock,
	provideTranslateServiceMock,
} from '../../../../../test-helpers';
import { HelpPage } from './help.page';

describe('HelpPage', () => {
	let component: HelpPage;
	let fixture: ComponentFixture<HelpPage>;
	let modalController: { dismiss: ReturnType<typeof vi.fn> };

	beforeEach(async (): Promise<void> => {
		modalController = createModalControllerMock() as unknown as {
			dismiss: ReturnType<typeof vi.fn>;
		};
		await TestBed.configureTestingModule({
			imports: [HelpPage],
			providers: [
				provideTranslateServiceMock(),
				{ provide: ModalController, useValue: modalController },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(HelpPage);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('renders help content and closes its modal', async (): Promise<void> => {
		expect(fixture.nativeElement.querySelector('ion-card')).toBeTruthy();

		await component.close();

		expect(modalController.dismiss).toHaveBeenCalledOnce();
	});
});
