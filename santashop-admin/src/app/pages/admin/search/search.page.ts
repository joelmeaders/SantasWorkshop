import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { AdminTextPipe } from '../../../shared/preferences/admin-text.pipe';
import { ByNamePage } from './by-name/by-name.page';
import { ByEmailPage } from './by-email/by-email.page';
import { ByCodePage } from './by-code/by-code.page';

@Component({
	selector: 'admin-search',
	templateUrl: './search.page.html',
	styleUrls: ['./search.page.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		HeaderComponent,
		AdminTextPipe,
		IonContent,
		ByNamePage,
		ByEmailPage,
		ByCodePage,
	],
})
export class SearchPage {
	public readonly method = signal<'name' | 'email' | 'code'>('name');
}
