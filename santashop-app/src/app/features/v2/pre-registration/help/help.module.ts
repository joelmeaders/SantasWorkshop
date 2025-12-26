import { NgModule } from '@angular/core';
import { HelpPage } from './help.page';
import { CoreModule } from '@santashop/core';
import { RouterModule } from '@angular/router';

@NgModule({
	imports: [
		CoreModule,
		RouterModule.forChild([
			{
				path: '',
				component: HelpPage,
			},
		]),
		HelpPage,
	],
})
export class HelpPageModule {}
