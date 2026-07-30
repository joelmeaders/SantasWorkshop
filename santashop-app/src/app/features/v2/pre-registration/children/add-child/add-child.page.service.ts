import { Injectable, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
	AnalyticsWrapper,
	PROGRAM_YEAR,
	yyyymmddToLocalDate,
	getAgeFromDate,
	validateChild,
	MAX_BIRTHDATE,
	MIN_BIRTHDATE,
} from '@santashop/core';
import { AlertController } from '@ionic/angular/standalone';
import {
	Child,
	ChildValidationError,
	ToyType,
	AgeGroup,
} from '@santashop/models';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, firstValueFrom, Observable, Subject } from 'rxjs';
import { takeUntil, shareReplay } from 'rxjs/operators';
import { PreRegistrationService } from '../../../../../core';
import { newChildForm } from './child.form';

@Injectable()
export class AddChildPageService implements OnDestroy {
	private readonly programYear = inject(PROGRAM_YEAR);
	private readonly preRegistrationService = inject(PreRegistrationService);
	private readonly alertController = inject(AlertController);
	private readonly translateService = inject(TranslateService);
	private readonly router = inject(Router);
	private readonly analytics = inject(AnalyticsWrapper);

	public readonly destroy$ = new Subject<void>();
	public form = newChildForm(this.programYear);

	private readonly isInfant = new BehaviorSubject<boolean>(false);
	public readonly isInfant$ = this.isInfant.pipe(
		takeUntil(this.destroy$),
		shareReplay(1),
	);

	private readonly isEdit = new BehaviorSubject<boolean>(false);
	public readonly isEdit$ = this.isEdit.pipe(
		takeUntil(this.destroy$),
		shareReplay(1),
	);

	public readonly children$: Observable<Child[] | undefined> =
		this.preRegistrationService.children$.pipe(
			takeUntil(this.destroy$),
			shareReplay(1),
		);

	constructor() {
		console.log(MIN_BIRTHDATE());
	}

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public async setChildToEdit(id: number): Promise<void> {
		const children = await firstValueFrom(this.children$);
		if (!children || children.length < 1) return;

		// Searching by number doesn't work. Converting to string
		// seems to work for some reason
		const child = children.find(
			(c) => !!c.id && c.id.toString() === id.toString(),
		);
		if (!child) return;

		this.form.patchValue({ ...child });

		// I opted not to use a 3rd party library this time, and
		// JS dates don't play well with Firebase Timestamps.
		const year = child.dateOfBirth.getFullYear();
		let month = (child.dateOfBirth.getMonth() + 1).toString();
		let day = child.dateOfBirth.getDate().toString();

		month = month.length === 2 ? month : `0${month}`;
		day = day.length === 2 ? day : `0${day}`;

		// Set birth date
		const date = `${year}-${month}-${day}`;
		this.form.controls.dateOfBirth.setValue(date as any as Date);

		await this.birthdaySelected(this.form.controls.dateOfBirth.value);
		this.isEdit.next(true);
	}

	public async editChild(): Promise<void> {
		const updatedChild = this.form.value as Child;
		updatedChild.dateOfBirth = yyyymmddToLocalDate(
			updatedChild.dateOfBirth as any,
		);

		const children = await firstValueFrom(this.children$);

		try {
			const validatedChild = validateChild(updatedChild);
			delete validatedChild.error;
			const updatedChildren = children?.filter(
				(child) => child.id !== validatedChild.id,
			);
			updatedChildren?.push(validatedChild);
			this.analytics.logEventWithParams('edit_child', {
				id: updatedChild.id,
			});
			return await this.updateRegistration(updatedChildren);
		} catch (ex) {
			const error = ex as ChildValidationError;
			let message = '';

			if (error.code === 'invalid_age') {
				message = this.translateService.instant('ADDCHILD.INVALID_AGE');
				this.analytics.logEventWithParams('edit_child_error', {
					id: updatedChild,
					error: error.code,
				});
			} else if (error.code === 'invalid_firstname') {
				message = this.translateService.instant(
					'ADD_CHILDREN.INVALID_FIRSTNAME',
				);
				this.analytics.logEventWithParams('edit_child_error', {
					id: updatedChild,
					error: error.code,
				});
			} else if (error.code === 'invalid_lastname') {
				message = this.translateService.instant(
					'ADD_CHILDREN.INVALID_LASTNAME',
				);
				this.analytics.logEventWithParams('edit_child_error', {
					id: updatedChild,
					error: error.code,
				});
			}

			await this.invalidEntryAlert(message);
			return;
		}
	}

	public setInfant(value: boolean): void {
		this.isInfant.next(true);

		const toyTypeControl = this.form.controls.toyType;
		const ageGroupControl = this.form.controls.ageGroup;

		if (value) {
			toyTypeControl.setValue(ToyType.infant);
			ageGroupControl.setValue(AgeGroup.age02);
		}
	}

	public async birthdaySelected(yyyymmdd: any): Promise<void> {
		if (!yyyymmdd) return;
		if (yyyymmdd[0]?.toString() !== '2') return;

		const dateOfBirth = yyyymmddToLocalDate(yyyymmdd);
		const ageInYears = getAgeFromDate(dateOfBirth, MAX_BIRTHDATE());
		let ageGroup: AgeGroup | undefined;

		if (ageInYears >= 0 && ageInYears < 3) {
			this.setInfant(true);
			return;
		} else if (ageInYears >= 3 && ageInYears < 6) {
			ageGroup = AgeGroup.age35;
		} else if (ageInYears >= 6 && ageInYears < 9) {
			ageGroup = AgeGroup.age68;
		} else if (ageInYears >= 9 && ageInYears < 12) {
			ageGroup = AgeGroup.age911;
		} else {
			this.analytics.logEventWithParams('child_invalid_age_entry', {
				age: ageInYears,
			});
			await this.childTooOldAlert();
			this.form.controls.dateOfBirth.reset();
		}

		this.form.controls.ageGroup.setValue(ageGroup!);
		this.isInfant.next(false);
	}

	private async childTooOldAlert(): Promise<any> {
		const alert = await this.alertController.create({
			header: this.translateService.instant('ADDCHILD.TOO_OLD_1'),
			message: this.translateService.instant('ADDCHILD.INVALID_AGE'),
			buttons: [
				{
					text: 'Ok',
				},
			],
		});

		await alert.present();
		return alert.onDidDismiss();
	}

	public async addChild(): Promise<void> {
		const child = this.form.value as Child;
		child.dateOfBirth = yyyymmddToLocalDate(child.dateOfBirth as any);

		const children = await firstValueFrom(this.children$);

		try {
			const validatedChild = validateChild(child);
			children?.push(validatedChild);
			this.analytics.logEvent('add_child');
			return await this.updateRegistration(children);
		} catch (ex) {
			const error = ex as ChildValidationError;
			let message = '';

			if (error.code === 'invalid_age') {
				message = this.translateService.instant('ADDCHILD.INVALID_AGE');
				this.analytics.logEventWithParams('add_child_error', {
					id: child,
					error: error.code,
				});
			} else if (error.code === 'invalid_firstname') {
				message = this.translateService.instant(
					'ADDCHILD.INVALID_FIRSTNAME',
				);
				this.analytics.logEventWithParams('add_child_error', {
					id: child,
					error: error.code,
				});
			} else if (error.code === 'invalid_lastname') {
				message = this.translateService.instant(
					'ADDCHILD.INVALID_LASTNAME',
				);
				this.analytics.logEventWithParams('add_child_error', {
					id: child,
					error: error.code,
				});
			}

			await this.invalidEntryAlert(message);
			return;
		}
	}

	public async removeChild(childToRemove: Child): Promise<void> {
		const children = await firstValueFrom(this.children$);

		const updatedChildren = children?.filter(
			(child) => child.id !== childToRemove.id,
		);

		this.analytics.logEventWithParams('remove_child', {
			id: childToRemove.id,
		});
		return this.updateRegistration(updatedChildren);
	}

	private async updateRegistration(children?: Child[]): Promise<void> {
		const registration = await firstValueFrom(
			this.preRegistrationService.userRegistration$,
		);

		if (!registration) {
			throw new Error('Registration object is undefined');
		}

		registration.children = children;

		await firstValueFrom(
			this.preRegistrationService.saveRegistration(registration),
		);

		this.router.navigate(['pre-registration/children']);
	}

	private async invalidEntryAlert(message: string): Promise<any> {
		const alert = await this.alertController.create({
			header: this.translateService.instant('ADDCHILD.TOO_OLD_1'),
			message,
			buttons: [{ text: this.translateService.instant('COMMON.OK') }],
		});

		await alert.present();
		return alert.onDidDismiss();
	}

	public resetForm(): void {
		this.form.reset();
		this.isInfant.next(false);
		this.isEdit.next(false);
	}
}
