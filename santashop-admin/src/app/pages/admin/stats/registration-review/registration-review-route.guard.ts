import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@santashop/core/admin';
import { map, take } from 'rxjs';
import {
	REGISTRATION_REVIEW_READER,
	canReadRegistrationReview,
} from './registration-review-reader';

export const registrationReviewGuard: CanActivateFn = () => {
	const router = inject(Router);
	const landing = router.createUrlTree(['/admin/landing']);
	if (!inject(REGISTRATION_REVIEW_READER, { optional: true })) return landing;

	return inject(AuthService).claimsResolved$.pipe(
		take(1),
		map((claims) =>
			canReadRegistrationReview(claims ?? undefined) ? true : landing,
		),
	);
};
