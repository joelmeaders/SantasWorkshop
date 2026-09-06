import {
	ChangeDetectorRef,
	DestroyRef,
	Pipe,
	PipeTransform,
	inject,
} from '@angular/core';
import { DatePipe, registerLocaleData } from '@angular/common';
import localeEsUs from '@angular/common/locales/es-US';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

registerLocaleData(localeEsUs);

@Pipe({
	name: 'localizedDate',
	standalone: true,
	pure: false,
})
export class LocalizedDatePipe implements PipeTransform {
	private readonly translate = inject(TranslateService);
	private readonly changeDetector = inject(ChangeDetectorRef);
	private readonly destroyRef = inject(DestroyRef);
	private readonly englishDatePipe = new DatePipe('en-US');
	private readonly spanishDatePipe = new DatePipe('es-US');

	constructor() {
		this.translate.onLangChange
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe(() => this.changeDetector.markForCheck());
	}

	public transform(
		value: Date | string | number | null | undefined,
		format = 'mediumDate',
		timezone?: string,
	): string | null {
		const datePipe =
			this.translate.getCurrentLang() === 'es'
				? this.spanishDatePipe
				: this.englishDatePipe;

		return datePipe.transform(value, format, timezone);
	}
}
