import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Child } from '@santashop/models';

import { NgIf, NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
	manOutline,
	womanOutline,
	happyOutline,
	alertCircle,
} from 'ionicons/icons';
import {
	IonCard,
	IonCardHeader,
	IonItem,
	IonCardTitle,
	IonBadge,
	IonCardContent,
	IonButton,
	IonList,
	IonIcon,
	IonLabel,
	IonNote,
} from '@ionic/angular/standalone';

@Component({
	selector: 'app-children-card',
	templateUrl: './children-card.component.html',
	styleUrls: ['./children-card.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		NgIf,
		RouterLink,
		NgFor,
		TranslateModule,
		IonCard,
		IonCardHeader,
		IonItem,
		IonCardTitle,
		IonBadge,
		IonCardContent,
		IonButton,
		IonList,
		IonIcon,
		IonLabel,
		IonNote,
	],
})
export class ChildrenCardComponent {
	@Input() public children?: Child[];

	@Input() public childCount = 0;

	constructor() {
		addIcons({ manOutline, womanOutline, happyOutline, alertCircle });
	}
}
