import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, shareReplay } from 'rxjs/operators';
import { PreRegistrationPageService } from './pre-registration.page.service';

@Component({
  selector: 'app-pre-registration',
  templateUrl: './pre-registration.page.html',
  styleUrls: ['./pre-registration.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PreRegistrationPageService],
})
export class PreRegistrationPage implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  public readonly childCount$ = this.viewService.childCount$.pipe(
    takeUntil(this.destroy$),
    shareReplay(1)
  );

  public readonly chosenSlot$ = this.viewService.chosenSlot$.pipe(
    takeUntil(this.destroy$),
    shareReplay(1)
  );

  constructor(private readonly viewService: PreRegistrationPageService) {}

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
