import { bootstrapApplication } from '@angular/platform-browser';
import { isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';

import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';

function readSafeAreaInset(side: 'top' | 'bottom'): number {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  el.style.pointerEvents = 'none';
  el.style.paddingTop = 'env(safe-area-inset-top)';
  el.style.paddingBottom = 'env(safe-area-inset-bottom)';
  (document.body ?? document.documentElement).appendChild(el);
  const style = getComputedStyle(el);
  const value = side === 'top' ? style.paddingTop : style.paddingBottom;
  el.remove();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function setAppHeight(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const safeTop = readSafeAreaInset('top');
  const safeBottom = readSafeAreaInset('bottom');
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const adjustedHeight = viewportHeight + safeBottom;
  document.documentElement.style.setProperty('--app-height', `${adjustedHeight}px`);
  document.documentElement.style.setProperty('--safe-area-top', `${safeTop}px`);
  document.documentElement.style.setProperty('--safe-area-bottom', `${safeBottom}px`);
}

if (typeof window !== 'undefined') {
  setAppHeight();
  window.addEventListener('resize', setAppHeight);
  window.addEventListener('orientationchange', setAppHeight);
  window.addEventListener('pageshow', setAppHeight);
  window.addEventListener('visibilitychange', setAppHeight);
  window.visualViewport?.addEventListener('resize', setAppHeight);
  window.visualViewport?.addEventListener('scroll', setAppHeight);
  setTimeout(setAppHeight, 0);
  setTimeout(setAppHeight, 300);
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes),
    provideHttpClient(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
}).catch((err: unknown) => {
  console.error('Application bootstrap failed', err);
});
