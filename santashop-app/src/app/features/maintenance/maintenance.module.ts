import { NgModule } from '@angular/core';
import { MaintenancePageRoutingModule } from './maintenance-routing.module';
import { MaintenancePage } from './maintenance.page';
import { CoreModule } from 'santashop-core/src/public-api';
import { SharedModule } from '../../shared/components/shared.module';

@NgModule({
	imports: [CoreModule, SharedModule, MaintenancePageRoutingModule],
	declarations: [MaintenancePage],
})
export class MaintenancePageModule {}
