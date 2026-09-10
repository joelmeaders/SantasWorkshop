import { Routes } from '@angular/router';
import { ADMIN_FIRESTORE_ROUTE_PROVIDERS } from './admin-firestore.providers';
import { adminRoutes } from './admin.routes';
import { AdminSessionComponent } from './admin-session.component';

export const adminFirestoreRoutes: Routes = [
	{
		path: '',
		providers: ADMIN_FIRESTORE_ROUTE_PROVIDERS,
		component: AdminSessionComponent,
		children: adminRoutes,
	},
];
