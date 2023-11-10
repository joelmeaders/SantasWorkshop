import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { FunctionsWrapper } from '@santashop/core';
import referringAgencies from '../../../../../../assets/referring-agencies.json';
import { AlertController, LoadingController } from '@ionic/angular';
import { IError } from '@santashop/models';
import { FormControl, FormGroup, Validators } from '@angular/forms';

@Component({
	selector: 'app-referral-card',
	templateUrl: './referral-card.component.html',
	styleUrls: ['./referral-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralCardComponent {
	public readonly allReferrals: string[] = referringAgencies.agencies;

	private readonly searchText = new BehaviorSubject<string | undefined>(
		undefined,
	);

	private readonly filteredReferrals$: Observable<string[]> =
		this.searchText.pipe(
			map((search) =>
				!!search && search.length
					? this.allReferrals.filter((ref) =>
							ref.toUpperCase().includes(search),
					  )
					: this.allReferrals,
			),
		);

	public readonly referrals$ = this.filteredReferrals$;

	private readonly referralChoice = new BehaviorSubject<string | undefined>(
		undefined
	);
	public readonly referralChoice$ = this.referralChoice.asObservable();

	public readonly otherForm = new FormGroup({
		other: new FormControl<string | undefined>(undefined, Validators.required)
	});

	constructor(
		private readonly functions: FunctionsWrapper,
		private readonly loadingController: LoadingController,
		private readonly alertController: AlertController,
	) {}

	public filter($event: any): void {
		const input = $event.detail?.value;
		this.searchText.next(input ? input.toUpperCase() : undefined);
	}

	public setChoice(choice?: string): void {
		if (choice !== 'Other') this.otherForm.controls.other.setValue(choice);
		
		this.referralChoice.next(choice);
		this.searchText.next(undefined);
	}

	public async submit(): Promise<void> {
		let value = this.referralChoice.getValue();
		if (!value?.length) return;

		if (value === 'Other') {
			const otherValue = this.otherForm.controls.other.value;
			if (otherValue && otherValue.length > 3) value = `Other:${otherValue}`;
		}

		await this.presentLoading();

		try {
			await this.functions.updateReferredBy({
				referredBy: value,
			});
		} catch (ex: any) {
			await this.loadingController.dismiss();
			await this.handleError(ex);
		} finally {
			await this.loadingController.dismiss();
		}
	}

	private async presentLoading(): Promise<void> {
		const loading = await this.loadingController.create({
			duration: 3000,
			message: 'Please wait...',
			translucent: true,
			backdropDismiss: false,
		});

		await loading.present();
	}

	private async handleError(error: IError): Promise<void> {
		const alert = await this.alertController.create({
			header: 'Error',
			subHeader: error.code,
			message: error.message,
			buttons: ['Ok'],
		});

		await alert.present();
	}
}
