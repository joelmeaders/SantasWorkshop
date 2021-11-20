import { Injectable } from '@angular/core';
import { ICheckIn, ICheckInAgeStats } from '@models/*';
import { take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ManualOperationsService {
  private readonly INDEX_COLLECTION = 'registrationsearchindex';
  private readonly REGISTRATION_COLLECTION = 'registrations';
  private readonly CHECKINS_COLLECTION = 'checkins';
  private readonly STATS_COLLECTION = 'stats';

  constructor(private readonly httpService: FireCRUDStateless) {}

  private allCheckins() {
    return this.httpService
      .readMany<ICheckIn>(this.CHECKINS_COLLECTION)
      .pipe(take(1));
  }

  private saveStats(stats: ICheckInAgeStats) {
    return this.httpService.update(this.STATS_COLLECTION, stats, 'checkinAgeStats').pipe(take(1)).toPromise();
  }

  public async aggregateAgeGroups() {
    const allCheckins = await this.allCheckins().toPromise();

    const stats: ICheckInAgeStats = {
      ageGroup02: 0,
      ageGroup35: 0,
      ageGroup68: 0,
      ageGroup911: 0,
      totalChildren: 0,
      totalb: 0,
      totalg: 0,
      totali: 0,
      lastRun: new Date()
    };

    allCheckins.forEach(checkin => {
      stats.ageGroup02 += checkin.stats.ageGroup02;
      stats.ageGroup35 += checkin.stats.ageGroup35;
      stats.ageGroup68 += checkin.stats.ageGroup68;
      stats.ageGroup911 += checkin.stats.ageGroup911;
      stats.totalb += checkin.stats.toyTypeBoy;
      stats.totalg += checkin.stats.toyTypeGirl;
      stats.totali += checkin.stats.toyTypeInfant;
    });

    stats.totalChildren = stats.ageGroup02 + stats.ageGroup35 + stats.ageGroup68 + stats.ageGroup911;

    await this.saveStats(stats);
    console.log('done');
  }

  // private allRegistrations() {
  //   return this.httpService.readMany<Registration>(this.REGISTRATION_COLLECTION, undefined, 'id')
  //     .pipe(take(1));
  // }

  // private async saveIndex(index: RegistrationSearchIndex) {
  //   await this.httpService.update(this.INDEX_COLLECTION, index, index.customerId).pipe(take(1)).toPromise();
  // }

  // public async buildRegistrationIndex() {

  //   const allRegistrations = await this.allRegistrations().toPromise();

  //   allRegistrations.forEach(async reg => {
  //       if (this.isComplete(reg)) {
  //         const indexable = this.registrationToSearchIndex(reg);
  //         await of().pipe(delay(50)).pipe(take(1)).toPromise();
  //         await this.saveIndex(JSON.parse(JSON.stringify(indexable)));
  //         console.log(`updated ${reg.id}`)
  //       }
  //   });

  // }

  // private registrationToSearchIndex(registration: Registration): RegistrationSearchIndex {

  //   const index = new RegistrationSearchIndex();

  //   index.customerId = registration.id;

  //   if (registration.code) {
  //     index.code = registration.code;
  //   }

  //   if (registration.firstName) {
  //     index.firstName = registration.firstName.toLowerCase().trim();
  //   }

  //   if (registration.lastName) {
  //     index.lastName = registration.lastName.toLowerCase().trim();
  //   }

  //   if (registration.zipCode) {
  //     index.zip = registration.zipCode;
  //   }

  //   return index;

  // }

  // private isComplete(data: Registration): boolean {
  //   if (!data) return false;
  //   if (!data.id) return false;
  //   if (!data.email) return false;
  //   if (!data.firstName) return false;
  //   if (!data.lastName) return false;
  //   if (!data.fullName) return false;
  //   if (!data.code) return false;
  //   if (!data.date) return false;
  //   if (!data.time) return false;
  //   if (!data.formattedDateTime) return false;
  //   if (!data.zipCode) return false;
  //   if (!data.children || !data.children.length) return false;
  //   return true;
  // }
}
