import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/library/library-page/library-page.component').then((m) => m.LibraryPageComponent),
  },
  {
    path: 'read/:id',
    loadComponent: () =>
      import('./features/reader/reader-page/reader-page.component').then((m) => m.ReaderPageComponent),
  },
  { path: '**', redirectTo: '' },
];
