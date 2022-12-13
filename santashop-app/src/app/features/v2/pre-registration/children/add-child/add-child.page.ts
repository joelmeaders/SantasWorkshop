import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MOBILE_EVENT } from '@core/*';
import { filter, map, takeUntil, tap } from 'rxjs/operators';
import { AddChildPageService } from './add-child.page.service';
import {
	AppStateService,
	ChildValidationService,
	MAX_BIRTHDATE,
	MIN_BIRTHDATE,
} from '../../../../../core';
import { RegistrationClosedPage } from '../../../../registration-closed/registration-closed.page';

@Component({
	selector: 'app-add-child',
	templateUrl: './add-child.page.html',
	styleUrls: ['./add-child.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [ChildValidationService, AddChildPageService],
})
export class AddChildPage {
	public readonly setChildSubscription = this.route.queryParamMap
		.pipe(
			takeUntil(this.viewService.destroy$),
			filter((params) => params.has('id')),
			map((params) => params.get('id') as any as number),
			tap((id) => this.viewService.setChildToEdit(id))
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
				})
			)
			.subscribe();

	constructor(
		private readonly viewService: AddChildPageService,
		private readonly route: ActivatedRoute,
		@Inject(MOBILE_EVENT) public readonly mobileEvent: boolean,
		private readonly appStateService: AppStateService
	) {}

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
