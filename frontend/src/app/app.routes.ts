import { Routes } from '@angular/router';

import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { HealthComponent } from './pages/health/health.component';

export const appRoutes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'health', component: HealthComponent },
  { path: 'network', loadComponent: () => import('./pages/network/network.component').then((module) => module.NetworkComponent) },
  { path: 'network/patch-panel', loadComponent: () => import('./pages/patch-panel/patch-panel.component').then((module) => module.PatchPanelComponent) },
  { path: 'network/diagnostics', loadComponent: () => import('./pages/diagnostics/diagnostics.component').then((module) => module.DiagnosticsComponent) }
];
