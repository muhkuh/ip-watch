import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Root shell component for the IP Watch PWA.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
export class AppComponent {}
