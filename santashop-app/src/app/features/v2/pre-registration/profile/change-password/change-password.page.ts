import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProfilePageService } from '../profile.page.service';

import { PreRegistrationMenuComponent } from '../../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CoreModule } from '@santashop/core';
import { addIcons } from "ionicons";
import { arrowBackSharp } from "ionicons/icons";
import { IonContent, IonGrid, IonRow, IonCol, IonButton, IonIcon, IonItem, IonCardTitle, IonCard, IonCardContent, IonList, IonInput, IonLabel } from "@ionic/angular/standalone";

@Component({
    selector: 'app-change-password',
    templateUrl: './change-password.page.html',
    styleUrls: ['./change-password.page.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [ProfilePageService],
    standalone: true,
    imports: [
        PreRegistrationMenuComponent,
        RouterLink,
        ReactiveFormsModule,
        TranslateModule,
        CoreModule,
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
        IonInput,
        IonLabel
    ],
})
export class ChangePasswordPage {
    public readonly form = this.viewService.changePasswordForm;

    constructor(private readonly viewService: ProfilePageService) {
        addIcons({ arrowBackSharp });
    }

    public changePassword(): void {
        this.viewService.changePassword();
    }
}
