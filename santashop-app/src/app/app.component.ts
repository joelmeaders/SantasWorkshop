import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import {
    AlertController,
    IonApp,
    IonRouterOutlet,
    ModalController,
    Platform,
} from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { AppStateService } from './core';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [IonApp, IonRouterOutlet, IonApp, IonRouterOutlet],
    providers: [ModalController],
})
export class AppComponent {
    constructor(
        private readonly platform: Platform,
        private readonly translateService: TranslateService,
        private readonly analyticsService: Analytics,
        private readonly appStateService: AppStateService,
        private readonly alertController: AlertController,
    ) {
        this.initializeApp();
    }

    public async initializeApp(): Promise<void> {
        await this.platform.ready().then(() => {
            // This is here to kick off the appstateservice
            if (!this.appStateService) throw new Error('Placeholder');
        });

        this.translateService.addLangs(['en', 'es']);
        this.translateService.setDefaultLang('en');

        const browserLang = this.translateService.getBrowserLang() ?? 'en';
        this.translateService.use(
            browserLang.match(/en|es/) ? browserLang : 'en',
        );

        logEvent(this.analyticsService, 'default_language', {
            value: browserLang,
        });

        const alert = await firstValueFrom(this.appStateService.globalAlert$);
        if (alert.enabled) await this.showGlobalMessage(alert);
    }

    public async showGlobalMessage(globalAlert: any): Promise<void> {
        const alert = await this.alertController.create({
            header: globalAlert.title,
            message: globalAlert.message,
            buttons: ['Dismiss'],
        });

        await alert.present();
    }
}
