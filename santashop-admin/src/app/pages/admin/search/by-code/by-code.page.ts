import { NgTemplateOutlet } from '@angular/common';
import { input } from '@angular/core';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
	UntypedFormGroup,
	UntypedFormControl,
	Validators,
	ReactiveFormsModule,
} from '@angular/forms';
import { SearchService } from '../search.service';
import { HeaderComponent } from '../../../../shared/components/header/header.component';

import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { backspaceOutline, searchOutline } from 'ionicons/icons';
import {
	IonRouterLink,
	IonContent,
	IonList,
	IonItem,
	IonLabel,
	IonInput,
	IonButton,
	IonIcon,
} from '@ionic/angular/standalone';

@Component({
	selector: 'admin-by-code',
	templateUrl: './by-code.page.html',
	styleUrls: ['./by-code.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NgTemplateOutlet,
		AdminTextPipe,
		HeaderComponent,
		ReactiveFormsModule,
		RouterLink,
		IonRouterLink,
		IonContent,
		IonList,
		IonItem,
		IonLabel,
		IonInput,
		IonButton,
		IonIcon,
	],
})
export class ByCodePage {
	public readonly embedded = input(false);
	private readonly searchService = inject(SearchService);

	public readonly form = new UntypedFormGroup({
		code: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: [
				Validators.required,
				Validators.maxLength(8),
				Validators.minLength(7),
			],
		}),
	});

	constructor() {
		addIcons({ backspaceOutline, searchOutline });
	}

	public search(): void {
		const data = this.form.value;
		this.searchService.searchByCode(data.code);
	}

	public reset(): void {
		this.form.reset();
	}
}
