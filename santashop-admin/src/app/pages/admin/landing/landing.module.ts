import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { LandingPageRoutingModule } from './landing-routing.module';

import { LandingPage } from './landing.page';

@NgModule({
	imports: [CommonModule, FormsModule, LandingPageRoutingModule, LandingPage],
})
export class LandingPageModule {}
