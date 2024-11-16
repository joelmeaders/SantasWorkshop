import { NgModule } from '@angular/core';
import { MaintenancePageRoutingModule } from './maintenance-routing.module';
import { MaintenancePage } from './maintenance.page';
import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [CoreModule, MaintenancePageRoutingModule, MaintenancePage],
})
export class MaintenancePageModule {}
