import { Injectable } from '@angular/core';
import { Query } from '@angular/fire/firestore';
import { take } from 'rxjs/operators';
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
        const indexable = this.registrationToSearchIndex(reg);
        await this.saveIndex(JSON.parse(JSON.stringify(indexable)));
    });

  }

  private registrationToSearchIndex(registration: Registration): RegistrationSearchIndex {

    const index = new RegistrationSearchIndex();

    index.customerId = registration.id;

    if (registration.code) {
      index.code = registration.code;
    }

    if (registration.firstName) {
      index.firstName = registration.firstName.toLowerCase();
    }

    if (registration.lastName) {
      index.lastName = registration.lastName.toLowerCase();
    }

    return index;

  }
}
