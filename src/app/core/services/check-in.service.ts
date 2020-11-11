import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Registration } from '@app/core/models/registration.model';
import { BehaviorSubject } from 'rxjs';
import { publishReplay, refCount } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CheckInService {

  private readonly _$qrCode = new BehaviorSubject<Registration>(null);
  public readonly $qrCode = this._$qrCode.pipe(
    publishReplay(1),
    refCount()
  );

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) { }

  public setQrCode(code: string) {
    const registration: Registration = JSON.parse(code);
    this.router.navigate(['/admin/check-in', registration.id]);
  }
}
