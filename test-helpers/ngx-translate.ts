import { Injectable, NgModule, Pipe, PipeTransform } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

@Pipe({
	name: 'translate',
	standalone: true,
})
export class TranslatePipeMock implements PipeTransform {
	public transform(query: string, ..._args: any[]): any {
		return query;
	}
}

@Injectable()
export class TranslateServiceStub {
	public get<T>(key: T): Observable<T> {
		return of(key);
	}
}

@NgModule({
	imports: [TranslatePipeMock],
	providers: [
		{ provide: TranslateService, useClass: TranslateServiceStub },
		{ provide: TranslatePipe, useClass: TranslatePipeMock },
	],
	exports: [TranslatePipeMock],
})
export class TranslateTestingModule {}
