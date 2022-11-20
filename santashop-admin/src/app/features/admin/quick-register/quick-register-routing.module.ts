import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QuickRegisterPage } from './quick-register.page';

const routes: Routes = [
	{
		path: '',
		component: QuickRegisterPage,
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule],
})
export class RegisterPageRoutingModule {}
