import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular/standalone';
import { FunctionsWrapper } from '@santashop/core/admin/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopperAccessPanelComponent } from './shopper-access-panel.component';

describe('Shopper access panel', () => {
	const update = vi.fn();
	const createAlert = vi.fn();
	const read = vi.fn();

	beforeEach(() => {
		vi.resetAllMocks();
		update.mockResolvedValue({ data: true });
		read.mockResolvedValue({ data: { disabled: false, audit: null } });
		TestBed.configureTestingModule({
			imports: [ShopperAccessPanelComponent],
			providers: [
				{ provide: AlertController, useValue: { create: createAlert } },
				{
					provide: FunctionsWrapper,
					useValue: {
						callableWrapper: (name: string) =>
							name === 'callableGetShopperAccess' ? read : update,
					},
				},
			],
		});
	});

	async function render(
		disabled = false,
	): Promise<
		ReturnType<typeof TestBed.createComponent<ShopperAccessPanelComponent>>
	> {
		read.mockResolvedValue({ data: { disabled, audit: null } });
		const fixture = TestBed.createComponent(ShopperAccessPanelComponent);
		fixture.componentRef.setInput('uid', 'shopper-1');
		fixture.componentRef.setInput('canManageAccess', true);
		await fixture.whenStable();
		return fixture;
	}

	it('requires an allowed reason and updates only the selected shopper account', async () => {
		const fixture = await render();
		expect(read).toHaveBeenCalledWith({ uid: 'shopper-1' });
		createAlert.mockImplementation(({ buttons }) =>
			Promise.resolve({
				present: () => Promise.resolve(),
				onDidDismiss: () => {
					expect(buttons[1].handler(undefined)).toBe(false);
					expect(buttons[1].handler('duplicate-registration')).toBe(
						true,
					);
					return Promise.resolve({ role: 'confirm' });
				},
			}),
		);

		await fixture.componentInstance.changeAccess(true);
		expect(update).toHaveBeenCalledExactlyOnceWith({
			uid: 'shopper-1',
			disabled: true,
			reason: 'duplicate-registration',
		});
	});

	it('makes restoring access a separate operation without a cancellation or a reason', async () => {
		const fixture = await render(true);
		createAlert.mockResolvedValue({
			present: () => Promise.resolve(),
			onDidDismiss: () => Promise.resolve({ role: 'confirm' }),
		});

		await fixture.componentInstance.changeAccess(false);
		expect(update).toHaveBeenCalledExactlyOnceWith({
			uid: 'shopper-1',
			disabled: false,
		});
	});

	it('does not send a confirmed action if permission or the record changed', async () => {
		const fixture = await render(true);
		createAlert.mockResolvedValue({
			present: () => Promise.resolve(),
			onDidDismiss: () => {
				fixture.componentRef.setInput('uid', 'shopper-2');
				fixture.componentRef.setInput('canManageAccess', false);
				return Promise.resolve({ role: 'confirm' });
			},
		});

		await fixture.componentInstance.changeAccess(false);
		expect(update).not.toHaveBeenCalled();
	});
});
