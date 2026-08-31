import { ChangeDetectionStrategy, Component } from '@angular/core';
import { InternalHeaderComponent } from '../../../shared/components/internal-header/internal-header.component';
import { IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
	selector: 'app-pre-registration',
	templateUrl: './pre-registration.page.html',
	styleUrls: ['./pre-registration.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		InternalHeaderComponent,
		IonRouterOutlet,
	],
})
export class PreRegistrationPage {}
