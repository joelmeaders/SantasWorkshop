import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
	AlertController,
	IonContent,
	IonList,
	IonListHeader,
	IonNote,
	IonItemDivider,
	IonLabel,
	IonItem,
	IonText,
	IonIcon,
	IonButton,
} from '@ionic/angular/standalone';
import { Child, Registration } from '@santashop/models';
import {
	catchError,
	firstValueFrom,
	from,
	Observable,
	Subject,
	switchMap,
	tap,
} from 'rxjs';
import { filterNullish } from '../../../../shared/helpers';
import { AppStateService } from '../../../../shared/services/app-state.service';
import { CheckInContextService } from '../../../../shared/services/check-in-context.service';
import { CheckInService } from '../../../../shared/services/check-in.service';
import { LookupService } from '../../../../shared/services/lookup.service';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { AsyncPipe, DatePipe } from '@angular/common';
import { ManageChildrenComponent } from '../../../../shared/components/manage-children/manage-children.component';
import { addIcons } from 'ionicons';
import { checkmarkCircle } from 'ionicons/icons';

@Component({
	selector: 'admin-review',
	templateUrl: './review.page.html',
	styleUrls: ['./review.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		HeaderComponent,
		ManageChildrenComponent,
		RouterLink,
		AsyncPipe,
		DatePipe,
		IonContent,
		IonList,
		IonListHeader,
		IonNote,
		IonItemDivider,
		IonLabel,
		IonItem,
		IonText,
		IonIcon,
		IonButton,
		IonContent,
		IonList,
		IonListHeader,
		IonNote,
		IonItemDivider,
		IonLabel,
		IonItem,
		IonText,
		IonIcon,
		IonButton,
		IonContent,
		IonList,
		IonListHeader,
		IonNote,
		IonItemDivider,
		IonLabel,
		IonItem,
		IonText,
		IonIcon,
		IonButton,
	],
})
export class ReviewPage {
	private readonly checkinContext = inject(CheckInContextService);
	private readonly lookupService = inject(LookupService);
	private readonly checkinService = inject(CheckInService);
	private readonly appStateService = inject(AppStateService);
	private readonly alertController = inject(AlertController);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	public readonly checkinEnabled$ = this.appStateService.checkinEnabled$;

	public wasEdited = false;

	public readonly registration$ = this.checkinContext.currentRegistration$;

	private readonly scanResult = new Subject<string | undefined>();
	private readonly lookupRegistration$: Observable<Registration> =
		this.scanResult.asObservable().pipe(
			filterNullish<string>(),
			switchMap((code) =>
				this.lookupService.getRegistrationByQrCode$(code),
			),
			filterNullish<Registration>(),
		);

	protected readonly setRegistrationSubscription = this.lookupRegistration$
		.pipe(
			tap((registration) => {
				this.checkinContext.setRegistration(registration);
				this.scanResult.next(undefined);
			}),
			catchError((error) =>
				from(this.missingRegistrationError(error)).pipe(
					filterNullish<Registration>(),
				),
			),
		)
		.subscribe();

	constructor() {
		addIcons({ checkmarkCircle });
		addIcons({ checkmarkCircle });
		addIcons({ checkmarkCircle });
	}

	public async ionViewDidEnter(): Promise<void> {
		this.wasEdited = false;

		// This would be set by the search service
		const code = this.route.snapshot?.params?.qrcode;
		if (code) this.scanResult.next(code);
	}

	public ionViewWillLeave(): void {
		this.checkinContext.resetRegistration();
		this.scanResult.next(undefined);
		this.wasEdited = false;
	}

	public async removeChild(childId: number): Promise<void> {
		const registration = await firstValueFrom(this.registration$);
		if (!registration) return;

		registration.children = registration.children?.filter(
			(e) => e.id !== childId,
		);
		this.checkinContext.setRegistration(registration);
		this.wasEdited = true;
	}

	public async editChild(child: Child): Promise<void> {
		const registration = await firstValueFrom(this.registration$);
		if (!registration) return;

		registration.children = registration.children?.filter(
			(e) => e.id !== child.id,
		);

		registration?.children?.push(child);
		this.checkinContext.setRegistration(registration);
	}

	public async addChild(child: Child): Promise<void> {
		const registration = await firstValueFrom(this.registration$);
		if (!registration) return;

		registration?.children?.push(child);
		this.checkinContext.setRegistration(registration);
	}

	public async checkIn(): Promise<void> {
		const registration = await firstValueFrom(this.registration$);
		if (!registration) return;

		try {
			const result: number = await this.checkinService.checkIn(
				registration,
				this.wasEdited,
			);

			this.checkinContext.setCheckIn(
				result,
				registration.qrcode ?? 'nocode',
			);
			this.router.navigate(['admin/checkin/confirmation']);
		} catch (error: any) {
			if (error.details.code === 6) {
				this.checkinContext.reset();
				this.router.navigate([
					'admin/checkin/duplicate',
					registration.uid,
				]);
				return;
			}

			const alert = await this.alertController.create({
				header: 'Error checking in',
				subHeader: `code: ${registration.qrcode}`,
				message: error?.message ?? error,
			});

			await alert.present();
			this.checkinContext.reset();
			await alert.onDidDismiss();
			await this.router.navigate(['admin/checkin/scan']);
		}
	}

	private async missingRegistrationError(error: any): Promise<undefined> {
		const alert = await this.alertController.create({
			header: 'Error',
			message: error.message,
			buttons: [{ text: 'OK' }, { text: 'Try Search', role: 'search' }],
		});

		await alert.present();
		const { role } = await alert.onDidDismiss();

		if (role === 'search') this.router.navigate(['admin/search']);
		return undefined;
	}
}
