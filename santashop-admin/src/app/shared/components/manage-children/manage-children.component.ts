import {
	Component,
	ChangeDetectionStrategy,
	Input,
	EventEmitter,
	Output,
	inject,
} from '@angular/core';
import {
	AlertController,
	ModalController,
	IonItemDivider,
	IonLabel,
	IonBadge,
	IonButton,
	IonIcon,
	IonItem,
	IonNote,
	IonItemSliding,
	IonItemOptions,
	IonItemOption,
} from '@ionic/angular/standalone';
import { Child } from '@santashop/models';
import { AddEditChildModalComponent } from '../add-edit-child-modal/add-edit-child-modal.component';
import { DatePipe } from '@angular/common';
import { addIcons } from 'ionicons';
import { addCircle, createOutline, trashOutline } from 'ionicons/icons';

@Component({
	selector: 'admin-manage-children',
	templateUrl: './manage-children.component.html',
	styleUrls: ['./manage-children.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: true,
	imports: [
		DatePipe,
		IonItemDivider,
		IonLabel,
		IonBadge,
		IonButton,
		IonIcon,
		IonItem,
		IonNote,
		IonItemSliding,
		IonItemOptions,
		IonItemOption,
	],
})
export class ManageChildrenComponent {
	private readonly modalController = inject(ModalController);
	private readonly alertController = inject(AlertController);

	@Input() public children: Child[] = [];

	@Output() public readonly adddedChild = new EventEmitter<Child>();
	@Output() public readonly editedChild = new EventEmitter<Child>();
	@Output() public readonly removedChild = new EventEmitter<number>();

	constructor() {
		addIcons({ addCircle, createOutline, trashOutline });
		addIcons({ addCircle, createOutline, trashOutline });
		addIcons({ addCircle, createOutline, trashOutline });
	}

	public async addEditChild(child?: Child): Promise<void> {
		const modal = await this.modalController.create({
			component: AddEditChildModalComponent,
			componentProps: {
				child,
			},
		});

		await modal.present();
		const result = await modal.onDidDismiss();
		if (!result.data || result.role === 'cancelled') return;

		if (result.role === 'add') {
			this.adddedChild.emit(result.data);
		} else {
			this.editedChild.emit(result.data);
		}
	}

	public async removeChild(childId: number): Promise<void> {
		const child = this.children.find((e) => e.id === childId);
		if (!child) return;

		const alert = await this.alertController.create({
			header: 'Are you sure?',
			subHeader: `${child.firstName} ${child.lastName}`,
			message: 'This child will be deleted',
			buttons: [
				{
					text: 'Cancel',
					role: 'cancel',
					cssClass: '',
				},
				{
					text: 'OK',
					role: 'confirm',
					cssClass: '',
				},
			],
		});

		await alert.present();
		const result = await alert.onDidDismiss();
		if (result.role === 'cancel') return;

		this.removedChild.emit(childId);
	}
}
