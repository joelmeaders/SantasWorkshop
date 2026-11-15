import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	inject,
	input,
	signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AlertController, IonButton, IonNote } from '@ionic/angular/standalone';
import { FunctionsWrapper } from '@santashop/core/admin/firestore';
import type {
	AdminShopperAccessStatus,
	ShopperAccessAudit,
} from '@santashop/models';
import {
	BehaviorSubject,
	catchError,
	defer,
	map,
	of,
	startWith,
	switchMap,
} from 'rxjs';
import { AdminDatePipe } from '../../../../shared/preferences/admin-date.pipe';
import { createAdminAlert } from '../../../../shared/preferences/admin-overlays';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';

const reasons = {
	'duplicate-registration': 'Duplicate registration',
	'suspected-automated-signup': 'Suspected automated signup',
	'registration-information-unverified':
		'Registration information couldn’t be verified',
} as const;

type Reason = keyof typeof reasons;
type UpdateAccess =
	| { uid: string; disabled: true; reason: Reason }
	| { uid: string; disabled: false };
type AccessState =
	| { uid: string; kind: 'loading' | 'error' }
	| {
			uid: string;
			kind: 'ready';
			disabled: boolean;
			reason?: string;
			disposition?: ShopperAccessAudit['disposition'];
			updatedBy?: string;
			updatedAt?: Date;
	  };

@Component({
	selector: 'admin-shopper-access-panel',
	imports: [AdminDatePipe, AdminTextPipe, IonButton, IonNote],
	templateUrl: './shopper-access-panel.component.html',
	styleUrl: './shopper-access-panel.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopperAccessPanelComponent {
	private readonly alerts = inject(AlertController);
	private readonly destroyRef = inject(DestroyRef);
	private readonly functions = inject(FunctionsWrapper);

	public readonly uid = input.required<string>();
	public readonly emailAddress = input<string>();
	public readonly canManageAccess = input.required<boolean>();
	private readonly refresh = new BehaviorSubject<void>(undefined);

	public readonly access = toSignal(
		toObservable(this.uid).pipe(
			switchMap((uid) =>
				this.refresh.pipe(
					switchMap(() =>
						defer(() =>
							this.functions.callableWrapper<
								{ uid: string },
								AdminShopperAccessStatus
							>('callableGetShopperAccess')({ uid }),
						).pipe(
							map(({ data }): AccessState => ({
								uid,
								kind: 'ready',
								disabled: data.disabled,
								reason: data.audit?.reason
									? reasons[data.audit.reason]
									: undefined,
								disposition: data.audit?.disposition,
								updatedBy: data.audit?.updatedBy,
								updatedAt: data.audit?.updatedAt
									? new Date(data.audit.updatedAt)
									: undefined,
							})),
							startWith({ uid, kind: 'loading' } as const),
							catchError(() =>
								of({ uid, kind: 'error' } as const),
							),
						),
					),
				),
			),
		),
	);
	public readonly busy = signal(false);
	public readonly failedUid = signal<string | undefined>(undefined);

	public loadAgain(): void {
		this.refresh.next();
	}

	public async changeAccess(disabled: boolean): Promise<void> {
		const uid = this.uid();
		const record = this.access();
		if (
			this.busy() ||
			!this.canManageCurrentShopper(uid) ||
			record?.uid !== uid ||
			record.kind !== 'ready' ||
			record.disabled === disabled
		)
			return;

		this.failedUid.set(undefined);
		this.busy.set(true);
		try {
			const action = await this.confirmAccessChange(uid, disabled);
			if (!action || !this.canManageCurrentShopper(uid)) return;
			await this.functions.callableWrapper<UpdateAccess, unknown>(
				'callableSetShopperAccess',
			)(action);
			if (this.canManageCurrentShopper(uid)) this.loadAgain();
		} catch {
			if (this.canManageCurrentShopper(uid)) this.failedUid.set(uid);
		} finally {
			if (!this.destroyRef.destroyed) this.busy.set(false);
		}
	}

	private canManageCurrentShopper(uid: string): boolean {
		return (
			!this.destroyRef.destroyed &&
			this.canManageAccess() &&
			this.uid() === uid
		);
	}

	private async confirmAccessChange(
		uid: string,
		disabled: boolean,
	): Promise<UpdateAccess | undefined> {
		let selected: Reason | undefined;
		const email = this.emailAddress();
		const alert = await createAdminAlert(this.alerts, () => ({
			header: disabled
				? 'Disable shopper access?'
				: 'Re-enable shopper access?',
			subHeader: email,
			message: disabled
				? 'Select a reason. This does not cancel a registration or send an email.'
				: 'This restores access only. It does not restore a canceled registration.',
			inputs: disabled
				? Object.entries(reasons).map(([value, label]) => ({
						type: 'radio' as const,
						value,
						label,
					}))
				: [],
			buttons: [
				{ text: 'Cancel', role: 'cancel' },
				{
					text: disabled ? 'Disable access' : 'Re-enable access',
					role: 'confirm',
					handler: (value: unknown): boolean => {
						if (!disabled) return true;
						if (
							typeof value !== 'string' ||
							!Object.hasOwn(reasons, value)
						) {
							return false;
						}
						selected = value as Reason;
						return true;
					},
				},
			],
		}));
		if (!this.canManageCurrentShopper(uid)) {
			alert.remove();
			return undefined;
		}
		await alert.present();
		const { role } = await alert.onDidDismiss();
		if (role !== 'confirm') return undefined;
		return disabled
			? selected
				? { uid, disabled, reason: selected }
				: undefined
			: { uid, disabled };
	}
}
