import { ChangeDetectionStrategy, Component } from '@angular/core';
import { HeaderComponent } from '../../../shared/components/header/header.component';

import { RouterLink } from '@angular/router';
import {
	IonRouterLink,
	IonContent,
	IonCardHeader,
	IonCardTitle,
	IonCardSubtitle,
	IonList,
	IonItem,
} from '@ionic/angular/standalone';

@Component({
	selector: 'admin-search',
	templateUrl: './search.page.html',
	styleUrls: ['./search.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		HeaderComponent,
		RouterLink,
		IonRouterLink,
		IonContent,
		IonCardHeader,
		IonCardTitle,
		IonCardSubtitle,
		IonList,
		IonItem,
	],
})
export class SearchPage {}
