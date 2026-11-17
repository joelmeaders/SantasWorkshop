import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '@santashop/core/admin';
import { HeaderComponent } from '../../../../shared/components/header/header.component';
import { AdminTextPipe } from '../../../../shared/preferences/admin-text.pipe';
import { RegistrationReviewPageComponent } from './registration-review-page.component';

@Component({
	selector: 'admin-registration-review-route',
	imports: [
		AdminTextPipe,
		HeaderComponent,
		IonContent,
		RegistrationReviewPageComponent,
	],
	template: `
		<admin-header
			[title]="'Registration review' | adminText"
			backRoute="/admin/landing"
		/>
		<ion-content class="ion-padding">
			<admin-registration-review-page
				[enabled]="true"
				[claims]="claims() ?? undefined"
			/>
		</ion-content>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationReviewRoutePage {
	public readonly claims = toSignal(inject(AuthService).claimsResolved$, {
		initialValue: undefined,
	});
}
