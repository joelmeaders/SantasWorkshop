import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
	AnalyticsWrapper,
	ErrorHandlerService,
	FunctionsWrapper,
} from '@santashop/core';
import { LoadingController } from '@ionic/angular/standalone';
import { IError, Registration } from '@santashop/models';
import { PreRegistrationService } from '../../../../core';
import { delay, firstValueFrom, of } from 'rxjs';

@Injectable()
export class SubmitPageService {
	private readonly preregistrationService = inject(PreRegistrationService);
	private readonly functions = inject(FunctionsWrapper);
	private readonly router = inject(Router);
	private readonly analytics = inject(AnalyticsWrapper);
	private readonly loadingController = inject(LoadingController);
	private readonly errorHandler = inject(ErrorHandlerService);

	public readonly children$ = this.preregistrationService.children$;
	public readonly childCount$ = this.preregistrationService.childCount$;
	public readonly dateTimeSlot$ = this.preregistrationService.dateTimeSlot$;
	public readonly registrationReadyToSubmit$ =
		this.preregistrationService.registrationReadyToSubmit$;

	public async submitRegistration(): Promise<void> {
		const loader = await this.loadingController.create({
			message: 'Submitting...',
		});

		await loader.present();

		this.analytics.logEvent('submit_registration');

		try {
			const registration = await firstValueFrom(
				this.preregistrationService.userRegistration$,
			);

			if (!registration) {
				throw new Error('Registration object is undefined');
			}

			const completionResult =
				await this.completeRegistration(registration);

			// This exception should never be hit since the function doesn't return false
			if (!completionResult)
				throw new Error(
					'Cloud Function error in completeRegistrationFunction()',
				);

			await this.sendToConfirmation();
		} catch (error) {
			this.errorHandler.completeRegistrationException(error as IError);
		} finally {
			await loader.dismiss();
		}
	}

	/**
	 * Completes the registration process for a user.
	 * @param registration - The registration object to be completed.
	 * @param attempts - The number of attempts made to complete the registration (default is 0).
	 * @returns A promise that resolves with the completion result or false if the maximum number of attempts has been reached.
	 */
	private async completeRegistration(
		registration: Registration,
		attempts = 0,
	): Promise<boolean> {
		const completeRegistrationFunction =
			this.functions.callableWrapper<Registration, boolean>(
				'completeRegistration',
			);

		try {
			if (attempts <= 1) {
				const completionResult =
					await completeRegistrationFunction(registration);
				return completionResult.data as boolean;
			} else {
				return false;
			}
		} catch {
			await firstValueFrom(of(1).pipe(delay(2000)));
			return this.completeRegistration(registration, attempts + 1);
		}
	}
	private async sendToConfirmation(): Promise<boolean> {
		// Small delay in case funcrtion is sleeping
		await firstValueFrom(of(1).pipe(delay(2000)));
		return this.router.navigate(['/pre-registration/confirmation']);
	}
}
