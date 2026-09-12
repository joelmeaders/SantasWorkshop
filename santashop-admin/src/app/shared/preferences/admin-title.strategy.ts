import { Injectable, effect, inject } from '@angular/core';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AdminLanguageService } from './admin-language.service';

@Injectable()
export class AdminTitleStrategy extends TitleStrategy {
	private readonly title = inject(Title);
	private readonly language = inject(AdminLanguageService);
	private source = 'DSCS Home';
	constructor() {
		super();
		effect(() => {
			this.language.language();
			this.apply();
		});
	}
	public override updateTitle(snapshot: RouterStateSnapshot): void {
		this.source = this.buildTitle(snapshot) ?? 'DSCS Home';
		this.apply();
	}
	private apply(): void {
		this.title.setTitle(this.language.text(this.source));
	}
}
