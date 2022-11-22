import { ChangeDetectionStrategy, Component, ViewChild } from '@angular/core';
import {
	UntypedFormControl,
	UntypedFormGroup,
	Validators,
} from '@angular/forms';
import { IonSlides } from '@ionic/angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { RegistrationSearchIndex } from '@models/*';
import { SearchService } from './search.service';

export type SearchType = 'name' | 'email' | 'code' | undefined;

@Component({
	selector: 'admin-search',
	templateUrl: './search.page.html',
	styleUrls: ['./search.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPage {
	private readonly searchType = new BehaviorSubject<SearchType>(undefined);
	public readonly searchType$ = this.searchType.asObservable();

	public searchResults$: Observable<RegistrationSearchIndex[]> | null = null;

	public readonly nameForm = new UntypedFormGroup({
		lastName: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: Validators.required,
		}),
		zipCode: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: [
				Validators.required,
				Validators.maxLength(5),
				Validators.minLength(5),
			],
		}),
	});

	public readonly emailForm = new UntypedFormGroup({
		emailAddress: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: [Validators.required, Validators.email],
		}),
	});

	public readonly codeForm = new UntypedFormGroup({
		code: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: [
				Validators.required,
				Validators.maxLength(8),
				Validators.minLength(8),
			],
		}),
	});

	@ViewChild('slider') protected readonly slider?: IonSlides;

	protected readonly swiperOptions = {
		allowSlideNext: false,
		allowSlidePrev: false,
		allowTouchMove: false,
	};

	constructor(private readonly searchService: SearchService) {}

	public async setSearchType(type: SearchType): Promise<void> {
		this.searchType.next(type);
		await this.slide(1);
	}

	private async slide(increment: number): Promise<void> {
		const currentSlide = await this.slider!.getActiveIndex();
		const nextSlide =
			increment === 0 ? undefined : increment + currentSlide;

		this.slider?.lockSwipes(false);
		await this.slider?.slideTo(nextSlide ?? 0);
		this.slider?.lockSwipes(true);
	}

	public async search(): Promise<void> {
		if (this.searchType.getValue() === 'name') {
			console.log('ok');

			const data = this.nameForm.value;
			this.searchResults$ = this.searchService.searchByLastNameZip(
				data.lastName,
				data.zipCode
			);
		}

		await this.slide(1);
	}

	public async reset(): Promise<void> {
		this.nameForm.reset();
		await this.slide(0);
	}
}
