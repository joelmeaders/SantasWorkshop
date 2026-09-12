import { beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideAdminLanguage } from './app/shared/preferences/admin-language.providers';

beforeEach(() => {
	localStorage.removeItem('santashop-admin-language');
	localStorage.removeItem('santashop-admin-theme');
	TestBed.configureTestingModule({ providers: [provideAdminLanguage()] });
});
