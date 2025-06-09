// src/app/features/home/home.component.ts
import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TodaysWorkoutComponent } from '../../dashboard/todays-workout/todays-workout';
// You might inject services here if the home page needs more dynamic data in the future
// import { UserService } from '../../core/services/user.service'; // Example

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, TodaysWorkoutComponent], // Import TodaysWorkoutComponent
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent implements OnInit {
  // private userService = inject(UserService); // Example if you had user-specific greetings
  userName = signal<string>('Fitness Enthusiast'); // Placeholder or fetch from a service
  private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

  constructor() { }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) { // Check if running in a browser
      window.scrollTo(0, 0);
    }    // Example: Fetch user's name if you have a user service
    // this.userService.getCurrentUser().subscribe(user => {
    //   if (user && user.name) {
    //     this.userName.set(user.name);
    //   }
    // });
  }
}