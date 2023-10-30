import { Component, ChangeDetectionStrategy } from '@angular/core';

const prefersDark = !!window.matchMedia('(prefers-color-scheme: dark)') ?? true;
if (prefersDark) document.body.classList.toggle('dark', prefersDark);

@Component({
	selector: 'admin-root',
	templateUrl: 'app.component.html',
	styleUrls: ['app.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
