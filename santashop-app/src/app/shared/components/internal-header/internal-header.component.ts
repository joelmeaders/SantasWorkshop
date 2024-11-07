import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from '@santashop/core';
import {
    PopoverController,
    IonIcon,
    IonHeader,
    IonToolbar,
    IonItem,
    IonButton,
} from '@ionic/angular/standalone';
import { PublicMenuComponent } from '../public-menu/public-menu.component';
import { NgIf, AsyncPipe } from '@angular/common';
import { addIcons } from "ionicons";
import { menuSharp } from "ionicons/icons";

@Component({
    selector: 'app-internal-header',
    templateUrl: './internal-header.component.html',
    styleUrls: ['./internal-header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        IonIcon,
        IonHeader,
        IonToolbar,
        IonItem,
        IonButton,
        NgIf,
        AsyncPipe,
        IonHeader,
        IonToolbar,
        IonItem,
        IonButton,
        IonIcon
    ],
})
export class InternalHeaderComponent {
    public readonly user$ = this.authService.currentUser$;

    constructor(
        private readonly authService: AuthService,
        private readonly popoverController: PopoverController,
    ) {
        addIcons({ menuSharp });
    }

    public async menu($event: any): Promise<void> {
        const popover = await this.popoverController.create({
            component: PublicMenuComponent,
            event: $event,
            translucent: true,
        });
        await popover.present();
    }
}
