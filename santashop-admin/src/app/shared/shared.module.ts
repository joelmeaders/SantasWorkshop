import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { HeaderComponent } from './components/header/header.component';
import { CheckInService } from './services/check-in.service';
import { LookupService } from './services/lookup.service';
import { AddEditChildModalComponent } from './components/add-edit-child-modal/add-edit-child-modal.component';
import { ReactiveFormsModule } from '@angular/forms';
import { ChildValidationService } from './services/child-validation.service';
import { RouterModule } from '@angular/router';

@NgModule({
	declarations: [HeaderComponent, AddEditChildModalComponent],
	imports: [CommonModule, IonicModule, ReactiveFormsModule, RouterModule],
	exports: [HeaderComponent, AddEditChildModalComponent],
	providers: [LookupService, CheckInService, ChildValidationService],
})
export class SharedModule {}
