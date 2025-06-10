import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common'; // For *ngFor if needed, or *ngIf

interface NavItem {
  path: string;
  label: string;
  iconSvgPath: string; // For SVG path data
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './navigation.html',
  styleUrls: ['./navigation.scss'] // Can be empty if all Tailwind
})
export class NavigationComponent {
  navItems: NavItem[] = [
    { path: '/home', label: 'Home', iconSvgPath: 'M3 9L12 3L21 9V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9Z M9 21V13H15V21Z' }, // Example: list-bullet
    { path: '/workout', label: 'Workouts', iconSvgPath: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z' }, // Example: list-bullet
    { path: '/history', label: 'History', iconSvgPath: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' }, // Example: clock
    { path: '/training-programs', label: 'Programs', iconSvgPath: 'M3 4H21V22H3V4Z M3 8H21 M7 2V6 M17 2V6 M6 11H8V13H6V11Z M10 11H12V13H10V11Z M14 11H16V13H14V11Z M6 15H8V17H6V15Z M10 15H12V17H10V15Z M14 15H16V17H14V15Z' }, // Example: clock
    // { path: '/profile/personal-bests', label: 'PBs', iconSvgPath: 'M6 3H18M8 3V5C8 7.20914 9.79086 9 12 9C14.2091 9 16 7.20914 16 5V3M10 9V17H14V9M8 20H16' }, // Example: clock
    { path: '/library', label: 'Library', iconSvgPath: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6-2.292m0-14.25v14.25c0 .621.504 1.125 1.125 1.125H19.5A2.25 2.25 0 0 0 21.75 18V5.25c0-.621-.504-1.125-1.125-1.125H13.125c-.621 0-1.125.504-1.125 1.125Z' }, // Example: book-open
    { path: '/history/dashboard', label: 'Stats', iconSvgPath: 'M3 17l6-6 4 2 8-8 M17 7l4 0l0 4' /* appropriate icon */ },
    { path: '/profile', label: 'Profile', iconSvgPath: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A1.875 1.875 0 0 1 18.126 22.5H5.874a1.875 1.875 0 0 1-1.373-2.382Z' }, // Example: user-circle
  ];
}