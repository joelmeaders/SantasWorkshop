import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IonCard, IonCardHeader, IonItem, IonCardTitle, IonCardContent, IonButton } from "@ionic/angular/standalone";

@Component({
    selector: 'app-submit-card',
    templateUrl: './submit-card.component.html',
    styleUrls: ['./submit-card.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [RouterLink, TranslateModule, IonCard, IonCardHeader, IonItem, IonCardTitle, IonCardContent, IonButton],
})
export class SubmitCardComponent {
    @Input() public canSubmit = false;
}
