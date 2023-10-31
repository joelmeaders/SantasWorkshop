import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { NiceFormErrorPipe } from './pipes/nice-form-error.pipe';
import { AppLetDirective } from './directives/let.directive';
import { TranslateModule } from '@ngx-translate/core';
import { ReactiveFormsModule } from '@angular/forms';

const modules = [
	CommonModule,
	IonicModule,
	ReactiveFormsModule,
	TranslateModule,
];

const directives = [AppLetDirective];

const pipes = [NiceFormErrorPipe];


@NgModule({
	imports: [...modules],
	declarations: [...directives, ...pipes],
	exports: [...modules, ...directives, ...pipes],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CoreModule {}
