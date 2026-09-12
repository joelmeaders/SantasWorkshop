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
	IonNote,
	IonButton,
	IonIcon,
} from '@ionic/angular/standalone';

@Component({
	selector: 'admin-by-name',
	templateUrl: './by-name.page.html',
	styleUrls: ['./by-name.page.scss'],
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
		IonNote,
		IonButton,
		IonIcon,
	],
})
export class ByNamePage {
	public readonly embedded = input(false);
	private readonly searchService = inject(SearchService);

	public readonly form = new UntypedFormGroup({
		lastName: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: Validators.required,
		}),
		zipCode: new UntypedFormControl(undefined, {
			nonNullable: true,
			validators: [
				Validators.required,
				Validators.maxLength(5),
				Validators.pattern(/^\d{5}$/),
				Validators.minLength(5),
			],
		}),
	});

	constructor() {
		addIcons({ backspaceOutline, searchOutline });
	}

	public search(): void {
		const data = this.form.value;
		this.searchService.searchByLastNameZip(data.lastName, data.zipCode);
	}

	public reset(): void {
		this.form.reset();
	}
}
