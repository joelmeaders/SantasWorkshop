import { NgModule } from '@angular/core';
import { HelpPageRoutingModule } from './help-routing.module';
import { HelpPage } from './help.page';
import { CoreModule } from '@santashop/core';

@NgModule({
	imports: [CoreModule, HelpPageRoutingModule, HelpPage],
})
export class HelpPageModule {}
