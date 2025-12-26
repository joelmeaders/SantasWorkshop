import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NiceFormErrorPipe } from './pipes/nice-form-error.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { ReactiveFormsModule } from '@angular/forms';

const modules = [CommonModule, ReactiveFormsModule, TranslateModule];

const directives: never[] = [];

const pipes = [NiceFormErrorPipe];

@NgModule({
	imports: [...modules, ...directives, ...pipes],
	exports: [...modules, ...directives, ...pipes],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CoreModule {}
