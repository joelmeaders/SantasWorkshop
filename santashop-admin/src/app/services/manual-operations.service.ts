import { Injectable } from '@angular/core';
import { Query } from '@angular/fire/firestore';
import { of } from 'rxjs';
import { delay, take } from 'rxjs/operators';
import { FireCRUDStateless, Registration, RegistrationSearchIndex } from 'santashop-core/src/public-api';

@Injectable({
  providedIn: 'root'
})
export class ManualOperationsService {

  private readonly INDEX_COLLECTION = 'registrationsearchindex';
  private readonly REGISTRATION_COLLECTION = 'registrations';

  constructor(
    private readonly httpService: FireCRUDStateless
  ) { }

  private allRegistrations() {
    return this.httpService.readMany<Registration>(this.REGISTRATION_COLLECTION, undefined, 'id')
      .pipe(take(1));
  }

  private async saveIndex(index: RegistrationSearchIndex) {
    await this.httpService.update(this.INDEX_COLLECTION, index, index.customerId).pipe(take(1)).toPromise();
  }

  public async buildRegistrationIndex() {

    const allRegistrations = await this.allRegistrations().toPromise();

    allRegistrations.forEach(async reg => {
        if (this.isComplete(reg)) {
          const indexable = this.registrationToSearchIndex(reg);
          await of().pipe(delay(50)).pipe(take(1)).toPromise();
          await this.saveIndex(JSON.parse(JSON.stringify(indexable)));
          console.log(`updated ${reg.id}`)
        }
    });

  }

  private registrationToSearchIndex(registration: Registration): RegistrationSearchIndex {

    const index = new RegistrationSearchIndex();

    index.customerId = registration.id;

    if (registration.code) {
      index.code = registration.code;
    }

    if (registration.firstName) {
      index.firstName = registration.firstName.toLowerCase().trim();
    }

    if (registration.lastName) {
      index.lastName = registration.lastName.toLowerCase().trim();
    }

    if (registration.zipCode) {
      index.zip = registration.zipCode;
    }

    return index;

  }

  private isComplete(data: Registration): boolean {
    if (!data) return false;
    if (!data.id) return false;
    if (!data.email) return false;
    if (!data.firstName) return false;
    if (!data.lastName) return false;
    if (!data.fullName) return false;
    if (!data.code) return false;
    if (!data.date) return false;
    if (!data.time) return false;
    if (!data.formattedDateTime) return false;
    if (!data.zipCode) return false;
    if (!data.children || !data.children.length) return false;
    return true;
  }
}
