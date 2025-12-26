import { NgModule } from '@angular/core';
import { HelpPage } from './help.page';
import { RouterModule } from '@angular/router';

@NgModule({
	imports: [
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
