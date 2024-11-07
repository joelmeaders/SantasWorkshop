import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PreRegistrationService } from '../../../../core';
import { ProfilePageService } from './profile.page.service';

import { NgIf, AsyncPipe } from '@angular/common';
import { PreRegistrationMenuComponent } from '../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from "ionicons";
import { arrowBackSharp, createOutline } from "ionicons/icons";
import { IonContent, IonGrid, IonRow, IonCol, IonButton, IonIcon, IonItem, IonCardTitle, IonCard, IonCardContent, IonList, IonInput } from "@ionic/angular/standalone";

@Component({
    selector: 'app-profile',
    templateUrl: './profile.page.html',
    styleUrls: ['./profile.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [ProfilePageService],
    standalone: true,
    imports: [
        NgIf,
        PreRegistrationMenuComponent,
        RouterLink,
        AsyncPipe,
        TranslateModule,
        IonContent,
        IonGrid,
        IonRow,
        IonCol,
        IonButton,
        IonIcon,
        IonItem,
        IonCardTitle,
        IonCard,
        IonCardContent,
        IonList,
        IonInput
    ],
})
export class ProfilePage {
    public readonly profileForm = this.viewService.profileForm;

    public readonly changeEmailForm = this.viewService.changeEmailForm;

    public readonly changePasswordForm = this.viewService.changePasswordForm;

    public readonly userProfile$ = this.viewService.userProfile$;

    public readonly isRegistrationComplete$ =
        this.preregistrationService.registrationComplete$;

    public readonly updateProfile = (): Promise<void> =>
        this.viewService.updatePublicProfile();

    public readonly changeEmailAddress = (): Promise<void> =>
        this.viewService.changeEmailAddress();

    public readonly changePassword = (): Promise<void> =>
        this.viewService.changePassword();

    constructor(
        private readonly viewService: ProfilePageService,
        private readonly preregistrationService: PreRegistrationService,
    ) {
        addIcons({ arrowBackSharp, createOutline });
    }
}
