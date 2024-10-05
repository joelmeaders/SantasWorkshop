import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
    UntypedFormControl,
    UntypedFormGroup,
    Validators,
    ReactiveFormsModule,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@santashop/core';
import { environment } from '../../../environments/environment';

import { NgIf } from '@angular/common';
import { IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput, IonNote, IonToolbar, IonButton, IonGrid, IonRow, IonCol } from "@ionic/angular/standalone";

@Component({
    selector: 'admin-sign-in',
    templateUrl: './sign-in.page.html',
    styleUrls: ['./sign-in.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [ReactiveFormsModule, NgIf, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonLabel, IonInput, IonNote, IonToolbar, IonButton, IonGrid, IonRow, IonCol],
})
export class SignInPage {
    public readonly environmentName = `${environment.name}_${environment.label}`;
    public readonly environmentVersion = environment.version;

    protected readonly form = new UntypedFormGroup({
        emailAddress: new UntypedFormControl(undefined, [
            Validators.email,
            Validators.required,
        ]),
        password: new UntypedFormControl(undefined, [Validators.required]),
    });

    constructor(
        private readonly authService: AuthService,
        private readonly router: Router,
    ) { }

    public async login(): Promise<void> {
        try {
            await this.authService
                .login({ ...this.form.value })
                .then(() => this.router.navigate(['/admin']));
        } catch (error) {
            console.error(error);
        }
    }
}
