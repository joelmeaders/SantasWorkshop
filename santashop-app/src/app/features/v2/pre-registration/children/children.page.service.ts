import { Injectable, OnDestroy } from '@angular/core';
import { Child } from '@santashop/models';
import { firstValueFrom, Observable, Subject } from 'rxjs';
import { takeUntil, shareReplay, map } from 'rxjs/operators';
import { PreRegistrationService } from '../../../../core';

@Injectable()
export class ChildrenPageService implements OnDestroy {
	private readonly destroy$ = new Subject<void>();

	public readonly children$: Observable<Child[] | undefined> =
		this.preRegistrationService.children$.pipe(
			takeUntil(this.destroy$),
			shareReplay(1),
		);

	public readonly childCount$: Observable<number> = this.children$.pipe(
		map((children) => children?.length ?? 0),
		takeUntil(this.destroy$),
		shareReplay(1),
	);

	constructor(
		public readonly preRegistrationService: PreRegistrationService,
	) {}

	public ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
	}

	public async removeChild(childToRemove: Child): Promise<void> {
		const children = await firstValueFrom(this.children$);

		const updatedChildren = children?.filter(
			(child) => child.id !== childToRemove.id,
		);

		return this.updateRegistration(updatedChildren);
	}

	public async updateRegistration(children?: Child[]): Promise<void> {
		const registration = await firstValueFrom(
			this.preRegistrationService.userRegistration$,
		);

		if (!registration) {
			// FIXME: Error handling
			throw new Error('Registration object is undefined');
		}

		registration.children = children;

		// FIXME: Error handling
		const storeRegistration = firstValueFrom(
			this.preRegistrationService.saveRegistration(registration),
		);

		try {
			await storeRegistration;
		} catch (error) {
			// FIXME: Do something
		}
	}
}
