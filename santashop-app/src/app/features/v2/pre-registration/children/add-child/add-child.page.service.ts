import { Inject, Injectable, OnDestroy } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Router } from '@angular/router';
import {
	PROGRAM_YEAR,
	yyyymmddToLocalDate,
	getAgeFromDate,
	validateChild,
	MAX_BIRTHDATE,
	MIN_BIRTHDATE,
} from '@santashop/core';
import { AlertController } from '@ionic/angular';
import {
	Child,
	ChildValidationError,
	ToyType,
	AgeGroup,
} from '@santashop/models';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, firstValueFrom, Observable, Subject } from 'rxjs';
import { takeUntil, shareReplay } from 'rxjs/operators';
import {
	PreRegistrationService,
} from '../../../../../core';
import { newChildForm } from './child.form';

@Injectable()
export class AddChildPageService implements OnDestroy {
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

	constructor(
		@Inject(PROGRAM_YEAR) private readonly programYear: number,
		private readonly preRegistrationService: PreRegistrationService,
		private readonly alertController: AlertController,
		private readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly analytics: Analytics,
	) {
	console.log(MIN_BIRTHDATE())

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
		const child = children.filter(
			(c) => !!c.id && c.id.toString() === id.toString(),
		)[0];
		if (!child) return;

		this.form.patchValue({ ...child });

		// TODO: Improve this horrible date stuff at some point.
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
			const validatedChild =
				validateChild(updatedChild);
			delete validatedChild.error;
			const updatedChildren = children?.filter(
				(child) => child.id !== validatedChild.id,
			);
			updatedChildren?.push(validatedChild);
			logEvent(this.analytics, 'edit_child', {
				id: updatedChild.id,
			});
			return await this.updateRegistration(updatedChildren);
		} catch (ex) {
			const error = ex as ChildValidationError;
			let message = '';

			if (error.code === 'invalid_age') {
				message = this.translateService.instant('ADDCHILD.INVALID_AGE');
				logEvent(this.analytics, 'edit_child_error', {
					id: updatedChild,
					error: error.code,
				});
			} else if (error.code === 'invalid_firstname') {
				message = this.translateService.instant(
					'ADD_CHILDREN.INVALID_FIRSTNAME',
				);
				logEvent(this.analytics, 'edit_child_error', {
					id: updatedChild,
					error: error.code,
				});
			} else if (error.code === 'invalid_lastname') {
				message = this.translateService.instant(
					'ADD_CHILDREN.INVALID_LASTNAME',
				);
				logEvent(this.analytics, 'edit_child_error', {
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
			logEvent(this.analytics, 'child_invalid_age_entry', {
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
			const validatedChild =
				validateChild(child);
			children?.push(validatedChild);
			logEvent(this.analytics, 'add_child');
			return await this.updateRegistration(children);
		} catch (ex) {
			const error = ex as ChildValidationError;
			let message = '';

			if (error.code === 'invalid_age') {
				message = this.translateService.instant('ADDCHILD.INVALID_AGE');
				logEvent(this.analytics, 'add_child_error', {
					id: child,
					error: error.code,
				});
			} else if (error.code === 'invalid_firstname') {
				message = this.translateService.instant(
					'ADDCHILD.INVALID_FIRSTNAME',
				);
				logEvent(this.analytics, 'add_child_error', {
					id: child,
					error: error.code,
				});
			} else if (error.code === 'invalid_lastname') {
				message = this.translateService.instant(
					'ADDCHILD.INVALID_LASTNAME',
				);
				logEvent(this.analytics, 'add_child_error', {
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

		logEvent(this.analytics, 'remove_child', {
			id: childToRemove.id,
		});
		return this.updateRegistration(updatedChildren);
	}

	private async updateRegistration(children?: Child[]): Promise<void> {
		const registration = await firstValueFrom(
			this.preRegistrationService.userRegistration$,
		);

		registration.children = children;

		// TODO: Error handling
		const storeRegistration = firstValueFrom(
			this.preRegistrationService.saveRegistration(registration),
		);

		try {
			await storeRegistration;
		} catch (error) {
			// TODO: Do something
		}

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
		this.form = newChildForm(this.programYear);
	}
}
