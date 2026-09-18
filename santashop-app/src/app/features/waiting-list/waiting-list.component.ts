import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	Injector,
	input,
	output,
	signal,
	untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AppStateService, AuthService } from '@santashop/core/customer';
import {
	defaultWaitingListSettings,
	type DateTimeSlot,
	type Registration,
	type WaitingListSource,
	type WaitingListState,
} from '@santashop/models';
import { IonButton, IonSpinner } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { WaitingListService } from './waiting-list.service';

@Component({
	selector: 'app-waiting-list',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslateModule, IonButton, IonSpinner],
	templateUrl: './waiting-list.component.html',
	styleUrls: ['./waiting-list.component.scss'],
})
export class WaitingListComponent {
	private readonly injector = inject(Injector);
	private get service(): WaitingListService {
		return this.injector.get(WaitingListService);
	}
	private readonly auth = inject(AuthService);
	private readonly appState = inject(AppStateService);
	public readonly source = input<WaitingListSource>('overview');
	public readonly useLoadedData = input(false);
	public readonly registration = input<Registration | undefined>();
	public readonly dataError = input(false);
	public readonly showDataError = computed(() =>
		this.dataError() && this.settings().joiningEnabled && !this.state(),
	);
	public readonly retry = output<void>();
	public readonly pending = computed(
		() =>
			this.loading() ||
			(this.useLoadedData() &&
				this.settings().joiningEnabled &&
				!this.state() &&
				!this.dataError() &&
				(!this.registration() || !this.slots())),
	);
	public readonly slots = input<DateTimeSlot[] | undefined>();
	public readonly user = toSignal(this.auth.currentUser$, {
		initialValue: null,
	});
	public readonly settings = toSignal(
		this.appState.waitingListSettings$ ?? of(defaultWaitingListSettings()),
		{ initialValue: defaultWaitingListSettings() },
	);
	public readonly loading = signal(false);
	public readonly busy = signal(false);
	public readonly consent = signal(false);
	public readonly error = signal(false);
	public readonly saved = signal(false);
	private readonly remote = signal<WaitingListState | undefined>(undefined);
	private readonly membershipOverride = signal<boolean | undefined>(undefined);
	private version = 0;
	private request?: { active: boolean; mutationId: string };
	public readonly state = computed<WaitingListState | undefined>(() => {
		if (!this.user()) return undefined;
		if (!this.useLoadedData()) return this.remote();
		const registration = this.registration();
		if (!registration) return undefined;
		if (
			registration.registrationSubmittedOn ||
			registration.dateTimeSlot ||
			registration.hasCheckedIn
		)
			return {
				active: false,
				canJoin: false,
				reason: registration.dateTimeSlot
					? 'appointment-selected'
					: 'registered',
			};
		const active =
			this.membershipOverride() ?? registration.waitingList?.active ?? false;
		if (active) return { active, canJoin: false, reason: 'joined' };
		if (!this.settings().joiningEnabled)
			return { active: false, canJoin: false, reason: 'disabled' };
		if (this.dataError()) return undefined;
		const slots = this.slots();
		if (!slots) return undefined;
		const available = slots.some(
			(slot) =>
				slot.enabled &&
				slot.dateTime.valueOf() > Date.now() &&
				(slot.slotsReserved ?? 0) < slot.maxSlots,
		);
		return {
			active: false,
			canJoin: !available,
			reason: available ? 'capacity-available' : 'eligible',
		};
	});
	constructor() {
		effect(() => {
			const uid = this.user()?.uid;
			this.settings();
			const local = this.useLoadedData();
			untracked(() => {
				this.version++;
				this.remote.set(undefined);
				this.membershipOverride.set(undefined);
				this.error.set(false);
				this.saved.set(false);
				this.consent.set(false);
				this.request = undefined;
				if (!local && uid) void this.reload();
			});
		});
	}
	public async reload(): Promise<void> {
		if (this.useLoadedData()) {
			this.retry.emit();
			return;
		}
		const version = this.version;
		this.loading.set(true);
		this.error.set(false);
		try {
			const value = await this.service.read();
			if (version === this.version) this.remote.set(value);
		} catch {
			if (version === this.version) this.error.set(true);
		} finally {
			if (version === this.version) this.loading.set(false);
		}
	}
	public async change(active: boolean): Promise<void> {
		if (this.busy() || (active && (!this.consent() || !this.state()?.canJoin)))
			return;
		const version = this.version;
		this.busy.set(true);
		this.error.set(false);
		this.saved.set(false);
		if (this.request?.active !== active)
			this.request = { active, mutationId: crypto.randomUUID() };
		try {
			await this.service.set({ ...this.request, source: this.source() });
			if (version !== this.version) return;
			this.membershipOverride.set(active);
			this.remote.set({
				active,
				canJoin: !active && this.settings().joiningEnabled,
				reason: active ? 'joined' : 'eligible',
			});
			this.saved.set(true);
			this.consent.set(false);
			this.request = undefined;
			if (!this.useLoadedData()) await this.reload();
		} catch {
			if (version === this.version) this.error.set(true);
		} finally {
			this.busy.set(false);
		}
	}
}
