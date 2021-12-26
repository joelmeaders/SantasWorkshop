import { Auth } from "@angular/fire/auth";
import { AfAuthService } from "../services/af-auth.service";
import { FireRepoBase } from "../services/fire-repo-base.service";
import { FireRepoLite } from "../services/fire-repo-lite.service";

export function fireRepoLiteTestProvider() {
  const spy = jasmine.createSpy('fs');
  return [
    { provide: FireRepoLite },
    { provide: FireRepoBase, useValue: spy }
  ]
}


export function afAuthServiceTestProvider() {
  const spy = jasmine.createSpy('a');
  return [
    { provide: AfAuthService, useClass: AfAuthService },
    { provide: Auth, useValue: spy },
    
  ]
}