import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@app/core/services/auth.service';
import { PopoverController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { publishReplay, refCount, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-public-menu',
  templateUrl: './public-menu.component.html',
  styleUrls: ['./public-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicMenuComponent implements OnDestroy {

  private readonly $destroy = new Subject<boolean>();

  public readonly $isLoggedIn = this.authService.$userProfile.pipe(
    takeUntil(this.$destroy),
    publishReplay(1),
    refCount()
  );

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly popoverController: PopoverController
  ) { }

  public ngOnDestroy(): void {
    this.$destroy.next(true);
  }

  public async closeMenu() {
    await this.popoverController.dismiss();
  }

  public async home() {
    await this.router.navigate(['/']);
    await this.closeMenu();
  }

  public async profile() {
    await this.router.navigate(['/profile']);
    await this.closeMenu();
  }

  public async signIn() {
    await this.router.navigate(['/sign-in']);
    await this.closeMenu();
  }

  public async createAccount() {
    await this.router.navigate(['/sign-up']);
    await this.closeMenu();
  }

  public async logout() {
    await this.authService.logout();
    await this.closeMenu();
  }

}
