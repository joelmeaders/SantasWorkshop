import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MOBILE_EVENT } from '@core/*';
import { filter, map, takeUntil, tap } from 'rxjs/operators';
import {
	ChildValidationService,
	MAX_BIRTHDATE,
	MIN_BIRTHDATE,
} from '../../../../../core';
import { AddChildPageService } from './add-child.page.service';

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

	constructor(
		private readonly viewService: AddChildPageService,
		private readonly route: ActivatedRoute,
		@Inject(MOBILE_EVENT) public readonly mobileEvent: boolean
	) {}

	public async birthdaySelected() {
		await this.viewService.birthdaySelected();
	}

	public setInfant(isInfant: boolean) {
		this.viewService.setInfant(isInfant);
	}

	public async addChild() {
		await this.viewService.addChild();
	}

	public editChild() {
		return this.viewService.editChild();
	}
}
