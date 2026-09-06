import {
	ChangeDetectionStrategy,
	Component,
	inject,
	signal,
} from '@angular/core';
import {
	ModalController,
	IonHeader,
	IonToolbar,
	IonTitle,
	IonButton,
	IonContent,
	IonList,
	IonSearchbar,
	IonItemGroup,
	IonItemDivider,
	IonLabel,
	IonItem,
	IonInput,
} from '@ionic/angular/standalone';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { AsyncPipe } from '@angular/common';

@Component({
	selector: 'admin-referral-modal',
	templateUrl: './referral-modal.component.html',
	styleUrls: ['./referral-modal.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AsyncPipe,
		IonHeader,
		IonToolbar,
		IonTitle,
		IonButton,
		IonContent,
		IonList,
		IonSearchbar,
		IonItemGroup,
		IonItemDivider,
		IonLabel,
		IonItem,
		IonInput,
	],
})
export class ReferralModalComponent {
	private readonly modalController = inject(ModalController);

	public readonly allReferrals: string[] = [
		'Denver Human Services DHS',
		'School - Denver Public Schools (DPS)',
		'School - Other',
		'Medicaid ',
		'SNAP',
		'----------',
		'Adams County Human Services',
		'Catholic Charities',
		'Church/Religious',
		'Colorado Coalition for the Homeless',
		'CWEE - Center for Work Education Employment',
		"Denver Children's Home",
		'Denver Health',
		'Denver Housing Authority',
		'DSCS Email',
		'Focus Points',
		'Foodbanks',
		'Give Center',
		'Healthcare',
		'Housing/Shelters',
		'Hunger Free Colorado',
		'Metro Caring',
		'Mile High United Way/2-1-1',
		'Rocky Mountain Human Services',
		'Salvation Army',
		'Samaritan House',
		'The Gathering Place',
		'Volunteers of America',
		'Whiz Kids',
		'----------',
		'Other',
	];

	private readonly searchText = new BehaviorSubject<string | undefined>(
		undefined,
	);

	private readonly referralChoice = new BehaviorSubject<string | undefined>(
		undefined,
	);
	public readonly referralChoice$ = this.referralChoice.asObservable();

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

	public readonly otherName = signal('');

	public readonly validOtherName = (): boolean =>
		this.otherName().trim().length >= 3 &&
		this.otherName().trim().length <= 20;

	public filter($event: { detail?: { value?: string | null } }): void {
		const input = $event.detail?.value;
		this.searchText.next(input ? input.toUpperCase() : undefined);
	}

	public async setValue(ref: string): Promise<void> {
		this.referralChoice.next(ref);
		if (ref !== 'Other') await this.modalController.dismiss(ref);
	}

	public async dismiss(): Promise<void> {
		await this.modalController.dismiss();
	}

	public async saveOther(): Promise<void> {
		if (!this.validOtherName()) return;
		await this.modalController.dismiss(`Other:${this.otherName().trim()}`);
	}
}
