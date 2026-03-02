import { Routes } from '@angular/router';

import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { HealthComponent } from './pages/health/health.component';

export const appRoutes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'health', component: HealthComponent }
];
