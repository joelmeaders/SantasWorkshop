import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';

import { CoreModule } from '@santashop/core';
import { NgIf, AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from "ionicons";
import { logoFacebook, logoInstagram } from "ionicons/icons";
import { IonContent, IonButton, IonIcon } from "@ionic/angular/standalone";

@Component({
    selector: 'app-maintenance',
    templateUrl: './maintenance.page.html',
    styleUrls: ['./maintenance.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [CoreModule, NgIf, AsyncPipe, TranslateModule, IonContent, IonButton, IonIcon],
})
export class MaintenancePage {
    public readonly message$ = this.service.message$;

    constructor(public readonly service: AppStateService) {
        addIcons({ logoFacebook, logoInstagram });
    }
}
