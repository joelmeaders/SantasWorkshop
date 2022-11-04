import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';

@Component({
	selector: 'app-referral-card',
	templateUrl: './referral-card.component.html',
	styleUrls: ['./referral-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralCardComponent {
	public readonly allReferrals: string[] = [
		'Denver Human Services (DHS)',
		'Colorado Food Bank',
		'Friend or Family',
		'Other',
	];

	private readonly searchText = new BehaviorSubject<string | undefined>(
		undefined
	);

	private readonly filteredReferrals$: Observable<string[]> =
		this.searchText.pipe(
			map((search) =>
				!!search && search.length
					? this.allReferrals.filter((ref) =>
							ref.toUpperCase().includes(search)
					  )
					: this.allReferrals
			)
		);

	public readonly referrals$ = this.filteredReferrals$;

	private readonly referralChoice = new BehaviorSubject<string | undefined>(
		undefined
	);
	public readonly referralChoice$ = this.referralChoice.asObservable();

	public filter($event: any): void {
		const input = $event.detail?.value;
		this.searchText.next(input ? input.toUpperCase() : undefined);
	}

	public setChoice(choice?: string): void {
		this.referralChoice.next(choice);
		this.searchText.next(undefined);
	}
}
