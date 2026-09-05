import { Routes } from '@angular/router';
import { ADMIN_FIRESTORE_ROUTE_PROVIDERS } from './admin-firestore.providers';
import { adminRoutes } from './admin.routes';

export const adminFirestoreRoutes: Routes = [
	{
		path: '',
		providers: ADMIN_FIRESTORE_ROUTE_PROVIDERS,
		children: adminRoutes,
	},
];
