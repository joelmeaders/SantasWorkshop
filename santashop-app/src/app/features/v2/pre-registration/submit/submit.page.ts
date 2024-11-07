import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SubmitPageService } from './submit.page.service';

import { PreRegistrationMenuComponent } from '../../../../shared/components/pre-registration-menu/pre-registration-menu.component';
import { RouterLink } from '@angular/router';
import { NgIf, NgFor, NgClass, AsyncPipe, DatePipe } from '@angular/common';
import { CoreModule } from '@santashop/core';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from "ionicons";
import { arrowBackSharp, manOutline, womanOutline, happyOutline } from "ionicons/icons";
import { IonContent, IonGrid, IonRow, IonCol, IonButton, IonIcon, IonItem, IonCardTitle, IonCardHeader, IonCardSubtitle, IonLabel } from "@ionic/angular/standalone";

@Component({
    selector: 'app-submit',
    templateUrl: './submit.page.html',
    styleUrls: ['./submit.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [SubmitPageService],
    standalone: true,
    imports: [
        PreRegistrationMenuComponent,
        RouterLink,
        NgIf,
        NgFor,
        NgClass,
        CoreModule,
        AsyncPipe,
        DatePipe,
        TranslateModule,
        IonContent,
        IonGrid,
        IonRow,
        IonCol,
        IonButton,
        IonIcon,
        IonItem,
        IonCardTitle,
        IonCardHeader,
        IonCardSubtitle,
        IonLabel
    ],
})
export class SubmitPage {
    public readonly registrationReadyToSubmit$ =
        this.viewService.registrationReadyToSubmit$;

    constructor(public readonly viewService: SubmitPageService) {
        addIcons({ arrowBackSharp, manOutline, womanOutline, happyOutline });
    }

    public async submit(): Promise<void> {
        await this.viewService.submitRegistration();
    }
}
