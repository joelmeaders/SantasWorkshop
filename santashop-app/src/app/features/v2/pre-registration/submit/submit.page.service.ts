import { Injectable } from '@angular/core';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Router } from '@angular/router';
import { ErrorHandlerService } from '@core/*';
import { LoadingController } from '@ionic/angular';
import { IError } from '../../../../../../../santashop-models/src/public-api';
import { of } from 'rxjs';
import { take } from 'rxjs/operators';
import { PreRegistrationService } from '../../../../core';

@Injectable()
export class SubmitPageService {
	public readonly children$ = this.preregistrationService.children$;
	public readonly childCount$ = this.preregistrationService.childCount$;
	public readonly dateTimeSlot$ = this.preregistrationService.dateTimeSlot$;
	public readonly registrationReadyToSubmit$ =
		this.preregistrationService.registrationReadyToSubmit$;

	constructor(
		private readonly preregistrationService: PreRegistrationService,
		private readonly afFunctions: Functions,
		private readonly router: Router,
		private readonly analytics: Analytics,
		private readonly loadingController: LoadingController,
		private readonly errorHandler: ErrorHandlerService
	) {}

	public async submitRegistration(): Promise<boolean> {
		const loader = await this.loadingController.create({
			message: 'Submitting...',
		});

		await loader.present();

		await logEvent(this.analytics, 'submit_registration');

		try {
			const registration =
				await this.preregistrationService.userRegistration$
					.pipe(take(1))
					.toPromise();

			const completeRegistrationFunction = httpsCallable(
				this.afFunctions,
				'completeRegistration'
			);

			const completionResult = await completeRegistrationFunction(
				registration
			).catch((err) => {
				// TODO:
				console.error('error!!', err);
				return of(false);
			});

			return completionResult
				? await this.sendToConfirmation()
				: await Promise.reject(completionResult);
		} catch (error) {
			this.errorHandler.handleError(error as IError);
			return await Promise.resolve(false);
		} finally {
			await loader.dismiss();
		}
	}

	private sendToConfirmation(): Promise<boolean> {
		return this.router.navigate(['/pre-registration/confirmation']);
	}
}
