import { Component } from '@angular/core';
import { FireRepoLite } from '@core/*';
import { IDateTimeCount, IZipCodeCount, IRegistration } from '@models/*';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'admin-test',
  templateUrl: './test.page.html',
  styleUrls: ['./test.page.scss'],
})
export class TestPage {

  private readonly REGISTRATIONS = 'registrations';
  private readonly STATS = 'stats';

  private completedRegistrations = 0;
  private dateTimeCount: IDateTimeCount[] = [];
  private zipCodeCount: IZipCodeCount[] = [];

  constructor(
    private readonly httpService: FireRepoLite,
    // private readonly manualOperations: ManualOperationsService
  ) { }

  public async buildSearchIndex() {
    // await this.manualOperations.buildRegistrationIndex();
  }

  public async statsAgg() {
    // await this.manualOperations.aggregateAgeGroups();
  }

  private async storeRegistrations() {

    const doc: any = {
      completedRegistrations: this.completedRegistrations,
      dateTimeCount: this.dateTimeCount,
      zipCodeCount: this.zipCodeCount
    };

    await this.httpService.collection(COLLECTIONNAME).update(this.STATS, doc, 'registration-2020', true).pipe(take(1)).toPromise();

  }

  public async processRegistrations() {

    const allRegistrations = await this.loadAllRegistrations().pipe(take(1)).toPromise();

    allRegistrations.forEach(registration => {
      if (!this.isRegistrationComplete(registration)) {
        return;
      }

      this.completedRegistrations += 1;
      this.updateDateTimeCount(registration);
      this.updateZipCodeCount(registration);
    });

    await this.storeRegistrations();
  }

  private loadAllRegistrations(): Observable<IRegistration[]> {
    return this.httpService.readMany<IRegistration>(this.REGISTRATIONS);
  }

  private isRegistrationComplete(registration: IRegistration): boolean {
    if (!registration) return false;
    if (!registration.qrcode) return false;
    if (!registration.date) return false;
    if (!registration.time) return false;
    if (!registration.zipCode) return false;
    if (!registration.children || !registration.children.length) return false;
    return true;
  }

  private updateDateTimeCount(registration: IRegistration): void {

    const index = this.dateTimeCount.findIndex(e =>
      e.date === registration.date
      && e.time === registration.time);

    if (index > -1) {
      this.dateTimeCount[index].count += 1;
      this.dateTimeCount[index].childCount += registration.children.length;
      return;
    }

    const newItem: IDateTimeCount = {
      date: registration.date,
      time: registration.time,
      count: 1,
      childCount: registration.children.length
    };

    this.dateTimeCount.push(newItem);

  }

  private updateZipCodeCount(registration: IRegistration) {

    const index = this.zipCodeCount.findIndex(e =>
      e.zip === registration.zipCode);

    if (index > -1) {
      this.zipCodeCount[index].count += 1;
      this.zipCodeCount[index].childCount += registration.children.length;
      return;
    }

    const newItem: IZipCodeCount = {
      zip: registration.zipCode,
      count: 1,
      childCount: registration.children.length
    };

    this.zipCodeCount.push(newItem);
  }

}
