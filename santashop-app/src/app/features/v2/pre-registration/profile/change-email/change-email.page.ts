import { ChangeDetectionStrategy, Component } from '@angular/core';
import { map, shareReplay } from 'rxjs/operators';
import { ProfilePageService } from '../profile.page.service';

@Component({
  selector: 'app-change-email',
  templateUrl: './change-email.page.html',
  styleUrls: ['./change-email.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ProfilePageService],
})
export class ChangeEmailPage {
  public readonly form = this.viewService.changeEmailForm;

  public readonly email$ = this.viewService.userProfile$.pipe(
    map((profile) => profile.emailAddress),
    shareReplay(1)
  );

  constructor(private readonly viewService: ProfilePageService) {}

  public changeEmail() {
    this.viewService.changeEmailAddress();
  }
}
