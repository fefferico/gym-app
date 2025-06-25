import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common'; // For *ngFor if needed, or *ngIf

interface NavItem {
  path: string;
  label: string;
  iconSvgPath: string;
  exact?: boolean; // NEW: Optional property for exact matching
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
    { path: '/home', label: 'HOME', iconSvgPath: 'M3 9L12 3L21 9V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9Z M9 21V13H15V21Z', exact: true }, // Example: list-bullet
    { path: '/workout', label: 'ROUTINES', iconSvgPath: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z', exact: true }, // Example: list-bullet
    { path: '/history/list', label: 'HISTORY', iconSvgPath: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', exact: true }, // Example: clock
    { path: '/training-programs', label: 'PROGRAMS', iconSvgPath: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-3.75h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z', exact: true }, // Example: clock
    { path: '/history/dashboard', label: 'STATS', iconSvgPath: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941' /* appropriate icon */},
    { path: '/profile', label: 'PROFILE', iconSvgPath: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A1.875 1.875 0 0 1 18.126 22.5H5.874a1.875 1.875 0 0 1-1.373-2.382Z, exact: true' }, // Example: user-circle
    // { path: '/workout/routine/kb-workout-traker', label: 'KB', iconSvgPath: 'M70,50 Q70,40 80,40 Q90,40 90,50 L90,130 Q90,140 80,140 Q70,140 70,130 L70,50 Z M60,50 Q60,70 50,80 Q40,100 50,120 Q60,130 70,130 Q80,130 90,120 Q100,100 90,80 Q80,70 70,50 Z' }, // Example: user-circle
  ];
}