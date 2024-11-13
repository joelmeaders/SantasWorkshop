import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

import { LanguageToggleComponent } from '../shared/components/language-toggle/language-toggle.component';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    IonIcon,
    IonNote,
} from '@ionic/angular/standalone';
import { addIcons } from "ionicons";
import { logoFacebook, logoInstagram } from "ionicons/icons";

@Component({
    selector: 'app-home',
    templateUrl: 'home.page.html',
    styleUrls: ['home.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        IonContent,
        IonGrid,
        IonRow,
        IonCol,
        IonButton,
        IonIcon,
        IonNote,
        LanguageToggleComponent,
        RouterLink,
        TranslateModule,
        IonContent,
        IonGrid,
        IonRow,
        IonCol,
        IonButton,
        IonIcon,
        IonNote
    ],
})
export class HomePage implements OnDestroy {
    private readonly destroy$ = new Subject<void>();

    public readonly environmentName = `${environment.name}_${environment.label}`;
    public readonly environmentVersion = environment.version;

    constructor() {
        addIcons({ logoFacebook, logoInstagram });
    }

    public ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
