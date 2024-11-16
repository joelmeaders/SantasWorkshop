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
import { addIcons } from "ionicons";
import { backspaceOutline, searchOutline } from "ionicons/icons";
import { IonRouterLink, IonContent, IonCardHeader, IonCardTitle, IonCardSubtitle, IonList, IonItem, IonLabel, IonInput, IonButton, IonIcon } from "@ionic/angular/standalone";

@Component({
    selector: 'admin-by-code',
    templateUrl: './by-code.page.html',
    styleUrls: ['./by-code.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [HeaderComponent, ReactiveFormsModule, RouterLink, IonRouterLink, IonContent, IonCardHeader, IonCardTitle, IonCardSubtitle, IonList, IonItem, IonLabel, IonInput, IonButton, IonIcon, IonRouterLink, IonContent, IonCardHeader, IonCardTitle, IonCardSubtitle, IonList, IonItem, IonLabel, IonInput, IonButton, IonIcon],
})
export class ByCodePage {
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
