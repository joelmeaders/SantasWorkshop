import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { filter, map, take, tap } from 'rxjs/operators';
import { FireCRUDStateless } from 'santashop-core/src/public-api';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {

  private readonly PATH = 'parameters';
  private readonly DOCID = 'public';

  private readonly $publicParams =
    this.httpService.readOne(this.PATH, this.DOCID).pipe(
      take(1)
    );

  public readonly $isMaintenance = this.$publicParams.pipe(
    map((response: any) => response.maintenance as boolean)
  );

  public readonly $messageEn = this.$publicParams.pipe(
    map((response: any) => response.ennotification as string)
  );

  public readonly $messageEs = this.$publicParams.pipe(
    map((response: any) => response.esnotification as string)
  );


  public readonly subscription = this.$isMaintenance.pipe(
    filter((response: boolean) => !!response)
  ).subscribe(() => this.router.navigate(['/maintenance']));

  constructor(
    private readonly httpService: FireCRUDStateless,
    private readonly router: Router
  ) { }
}
