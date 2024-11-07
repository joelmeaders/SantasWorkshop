import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
	MOBILE_EVENT,
	MAX_BIRTHDATE,
	MIN_BIRTHDATE,
	CoreModule,
} from '@santashop/core';
import { filter, map, takeUntil, tap } from 'rxjs/operators';
import { AddChildPageService } from './add-child.page.service';
import { AppStateService } from '../../../../../core';
import { RegistrationClosedPage } from '../../../../registration-closed/registration-closed.page';

import { PreRegistrationMenuComponent } from '../../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { ReactiveFormsModule } from '@angular/forms';
import { NgIf, AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { arrowBackSharp, gift } from 'ionicons/icons';
import {
	IonContent,
	IonGrid,
	IonRow,
	IonCol,
	IonButton,
	IonIcon,
	IonItem,
	IonCardTitle,
	IonList,
	IonInput,
	IonListHeader,
	IonLabel,
	IonRadioGroup,
	IonRadio,
	IonText,
} from '@ionic/angular/standalone';

@Component({
	selector: 'app-add-child',
	templateUrl: './add-child.page.html',
	styleUrls: ['./add-child.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [AddChildPageService],
	standalone: true,
	imports: [
		PreRegistrationMenuComponent,
		RouterLink,
		ReactiveFormsModule,
		NgIf,
		CoreModule,
		AsyncPipe,
		TranslateModule,
		IonContent,
		IonGrid,
		IonRow,
		IonCol,
		IonButton,
		IonIcon,
		IonItem,
		IonCardTitle,
		IonList,
		IonInput,
		IonListHeader,
		IonLabel,
		IonRadioGroup,
		IonRadio,
		IonText,
	],
})
export class AddChildPage {
	public readonly setChildSubscription = this.route.queryParamMap
		.pipe(
			takeUntil(this.viewService.destroy$),
			filter((params) => params.has('id')),
			map((params) => params.get('id') as any as number),
			tap((id) => this.viewService.setChildToEdit(id)),
		)
		.subscribe();

	public readonly form = this.viewService.form;
	public readonly minBirthDate = MIN_BIRTHDATE().toISOString();
	public readonly maxBirthDate = MAX_BIRTHDATE().toISOString();
	public readonly isInfant$ = this.viewService.isInfant$;
	public readonly isEdit$ = this.viewService.isEdit$;

	protected readonly closedSubscription =
		this.appStateService.isRegistrationEnabled$
			.pipe(
				tap((enabled) => {
					if (!enabled)
						this.appStateService.setModal(RegistrationClosedPage);
				}),
			)
			.subscribe();

	constructor(
		private readonly viewService: AddChildPageService,
		private readonly route: ActivatedRoute,
		@Inject(MOBILE_EVENT) public readonly mobileEvent: boolean,
		private readonly appStateService: AppStateService,
	) {
		addIcons({ arrowBackSharp, gift });
		console.log('min birth date', this.minBirthDate);
		console.log('max birth date', this.maxBirthDate);
	}

	public ionViewDidLeave(): void {
		this.viewService.resetForm();
	}

	public async birthdaySelected($event: any): Promise<void> {
		await this.viewService.birthdaySelected($event.detail?.value);
	}

	public setInfant(isInfant: boolean): void {
		this.viewService.setInfant(isInfant);
	}

	public async addChild(): Promise<void> {
		await this.viewService.addChild();
	}

	public editChild(): Promise<void> {
		return this.viewService.editChild();
	}
}
