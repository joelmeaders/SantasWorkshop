import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { combineLatest, Subject } from 'rxjs';
import {
	filter,
	map,
	shareReplay,
	startWith,
	switchMap,
	takeUntil,
} from 'rxjs/operators';
import { PreRegistrationService } from '../../../../core';
import { ProfileService } from '../../../../core/services/profile.service';

import { NgIf, AsyncPipe } from '@angular/common';
import { ReferralCardComponent } from './referral-card/referral-card.component';
import { PreRegistrationMenuComponent } from '../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { ChildrenCardComponent } from './children-card/children-card.component';
import { ScheduleCardComponent } from './schedule-card/schedule-card.component';
import { SubmitCardComponent } from './submit-card/submit-card.component';
import { IonContent, IonGrid, IonRow, IonCol } from '@ionic/angular/standalone';

@Component({
	selector: 'app-overview',
	templateUrl: './overview.page.html',
	styleUrls: ['./overview.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		NgIf,
		ReferralCardComponent,
		PreRegistrationMenuComponent,
		ChildrenCardComponent,
		ScheduleCardComponent,
		SubmitCardComponent,
		AsyncPipe,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
	],
})
export class OverviewPage implements OnDestroy {
	private readonly destroy$ = new Subject<void>();

	public readonly userRegistration$ =
		this.preregistrationService.userRegistration$;

	public readonly referredBy$ = this.profileService.referredBy$.pipe(
		shareReplay(1),
	);

	public readonly children$ = this.preregistrationService.children$;
	public readonly childCount$ = this.preregistrationService.childCount$;
	public readonly dateTimeSlot$ = this.preregistrationService.dateTimeSlot$;
	public readonly registrationSubmitted$ =
		this.preregistrationService.registrationSubmitted$;

	public readonly canChooseDateTime$ = this.childCount$.pipe(
		startWith(0),
		takeUntil(this.destroy$),
		map((value) => value >= 1),
		filter((isTrue) => !!isTrue),
		switchMap(() => this.preregistrationService.noErrorsInChildren$),
		filter((errorFree) => !!errorFree),
		shareReplay(1),
	);

	public readonly canSubmit$ = combineLatest([
		this.childCount$,
		this.dateTimeSlot$,
	]).pipe(
		takeUntil(this.destroy$),
		map(([childCount, dateTimeSlot]) => childCount >= 1 && !!dateTimeSlot),
		shareReplay(1),
	);

	constructor(
		private readonly preregistrationService: PreRegistrationService,
		private readonly profileService: ProfileService,
	) {}

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}
}
