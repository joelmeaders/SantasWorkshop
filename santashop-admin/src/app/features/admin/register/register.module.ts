import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from 'santashop-admin/src/app/components/shared.module';
import { HydrateAgeGroupPipe } from 'santashop-admin/src/app/pipes/hydrate-age-group.pipe';
import { HydrateToyTypePipe } from 'santashop-admin/src/app/pipes/hydrate-toy-type.pipe';
import { RegisterPageRoutingModule } from './register-routing.module';
import { RegisterPage } from './register.page';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild([{ path: '', component: RegisterPage }]),
    RegisterPageRoutingModule,
    SharedModule
  ],
  providers: [
    HydrateAgeGroupPipe,
    HydrateToyTypePipe
  ],
  declarations: [RegisterPage]
})
export class RegisterPageModule {}
