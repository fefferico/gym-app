![Angular Version](https://img.shields.io/badge/Angular-20-DD0031?logo=angular) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3-38B2AC?logo=tailwind-css) ![TypeScript](https://img.shields.io/badge/TypeScript-v5-3178C6?logo=typescript)

***

# FitTrackPro 🏋️‍♂️: Your Advanced Fitness & Activity Tracking Companion

FitTrackPro is a powerful, browser-based application designed for fitness enthusiasts who want to meticulously track their physical activities, from structured gym workouts to daily life activities. It offers a rich set of features for logging, planning, and analyzing your fitness journey, all stored locally in your browser.

## ✨ Features

*   **Comprehensive Activity Logging**: Go beyond the gym. Log a wide variety of activities like team sports, outdoor adventures, fitness classes, and even home and lifestyle activities like gardening.
*   **Advanced Workout Tracking**: A feature-rich workout player to follow your routines in real-time. Create and customize your own workout routines with a vast, pre-loaded library of exercises.
*   **Detailed History & Statistics**: Dive deep into your performance with a combined history of all logged activities and workouts. A dedicated statistics dashboard provides insightful charts and data on your progress.
*   **Structured Training Programs**: Plan your long-term fitness strategy by creating multi-week programs. Supports both repeating weekly cycles and linear, week-by-week progressions.
*   **Personalization & Customization**: Tailor the app to your needs with a detailed user profile, customizable goals, and various application settings including theme and unit preferences.
*   **Data Management**: Your data is yours. Easily export your entire application data for backup and import it back whenever needed.

## Functionality in Detail

### Dashboard & Today's View

The home screen provides a central hub for your daily fitness activities:

*   **Today's Workout Card**: Displays your scheduled workout for the current day based on your active training program.
*   **Date Navigation**: Easily swipe or tap through days to view past logs or future scheduled workouts.
*   **Active Program Display**: Clearly shows which training program you are currently following.
*   **Log Unscheduled Activities**: If you do a workout that wasn't on your schedule, it will still appear on the day it was logged, marked as "Unscheduled".

### Activity Logging

FitTrackPro comes with a predefined list of over 20 activities across various categories:

*   **Log Diverse Activities**: Choose from activities like Running, Swimming, Yoga, HIIT Class, Hiking, and even Heavy Chores.
*   **Detailed Metrics**: For each activity, you can log:
    *   Date, Start Time, and End Time
    *   Duration (calculated automatically)
    *   Perceived Intensity (Low, Medium, High)
    *   Location (optional)
    *   Distance and Calories Burned (where applicable)
    *   Personal notes
*   **Manage Logs**: View detailed summaries of your logged activities and edit or delete them from your history.

### Exercise Library & Routines

*   **Vast Exercise Library**: Comes pre-loaded with hundreds of exercises categorized by bodyweight, barbells, dumbbells, kettlebells, machines, and more. Each exercise includes:
    *   A detailed description.
    *   Primary and secondary muscle groups targeted.
    *   Equipment needed.
*   **Custom Exercises**: You can add your own custom exercises to the library, including name, description, category, and muscle groups.
*   **Routine Builder**:
    *   Create, view, edit, and delete your own workout routines.
    *   Add exercises from the library or create custom ones on the fly.
    *   Specify sets, reps, weight, duration, rest times, and notes for each set.
    *   Supports various set types like **Standard**, **Warm-up**, **Dropset**, **AMRAP**, and **To Failure**.
    *   Group exercises into **Supersets**.
    *   Define a primary **Goal** for each routine (e.g., Hypertrophy, Strength, Tabata).

### Workout Player

The workout player is your real-time companion during a session:

*   **Live Tracking**: Guides you through your routine, showing the current exercise and set you are on.
*   **Real-time Data Entry**: Log the actual reps you achieve and weight you lift for each set.
*   **Timers**:
    *   **Rest Timer**: An automatic full-screen timer shows your rest period between sets.
    *   **Timed Set Timer**: For duration-based exercises, a timer counts down or up.
    *   **Preset Countdown**: An optional countdown timer before each set begins to help you get ready.
*   **Flexibility**:
    *   Add new exercises to your session on the fly.
    *   Skip sets or entire exercises.
    *   Mark exercises to be done later in the session.
*   **Session Management**: Pause and resume your workout at any time. If you close the browser, your paused session can be resumed later.

### Training Programs

For those who like to plan ahead, the Training Programs feature allows you to build a structured schedule:

*   **Linear & Cycled Programs**:
    *   **Linear**: Design a program with a specific, unique schedule for each week (e.g., a 12-week powerlifting program).
    *   **Cycled**: Create a repeating schedule that is not tied to a standard week (e.g., an Upper/Lower split that repeats every 4 days).
*   **Calendar View**: Visualize your active program's schedule on a weekly or monthly calendar, showing which routines are planned for which days.
*   **Program Activation**: Set a program as "active" to have it appear on your dashboard. You can have multiple active programs.

### History & Statistics

*   **Unified History**: A single, filterable list and calendar view that combines all your logged workouts and activities in chronological order.
*   **Statistics Dashboard**:
    *   **Key Metrics**: View your total workout count, total volume lifted, current streak, and longest streak.
    *   **Charts**: Visualize your progress with charts for volume distributed by muscle group and your total weekly volume over time.
    *   **Data Tables**: See detailed weekly summaries and a performance breakdown by muscle group.
*   **Personal Bests (PBs)**: The app automatically tracks your personal bests for each exercise, including:
    *   1, 3, and 5 Rep Max (both actual and estimated).
    *   Heaviest weight lifted for any number of reps.
    *   Max reps for bodyweight exercises.
    *   Max duration for timed holds.

### Profile & Settings

*   **User Profile**: Store your username, gender, and a history of your body measurements (weight, height, chest, waist, etc.).
*   **Measurement History**: Track your body measurements over time and view your progress in a chart. You can also upload and compare progress photos.
*   **App Settings**:
    *   **Units**: Choose between kilograms (kg) and pounds (lbs).
    *   **Theme**: Switch between a light and dark mode.
    *   **Workout Player**: Customize the behavior of the workout player, such as enabling countdown sounds or pre-set timers.
    *   **Progressive Overload**: Configure automatic suggestions for increasing weight or reps based on your past performance to ensure continuous progress.

## What You Can Do

*   Log any physical activity with detailed metrics.
*   Create, customize, and follow structured workout routines and long-term training programs.
*   Track your performance in real-time with a workout player.
*   Analyze your progress with a detailed history and visual statistics.
*   Add and manage your own custom exercises.
*   Track your body measurements and progress photos.
*   Backup and restore all your application data.

## What You Can't Do (Current Limitations)

*   **No Cloud Sync or User Accounts**: All data is stored locally in your web browser's storage. This means clearing your browser data will erase your application data. There are no user accounts or automatic cloud backups.
*   **No Social Features**: The application is designed for individual use and does not include features for sharing workouts or progress with other users.
*   **No Real-time Form Correction**: The "Kettlebell Workout Tracker" feature with pose detection is an experimental work-in-progress and is not integrated into the main workout logging flow.

## Getting Started

1.  **Set up your Profile**: Navigate to "Profile & Settings" to enter your username, measurements, and preferred units (kg/lbs).
2.  **Explore the Exercise Library**: Familiarize yourself with the available exercises.
3.  **Create a Routine**: Go to "My Routines" and build your first workout plan.
4.  **Start a Program (Optional)**: If you have a long-term plan, create a Training Program and schedule your routines.
5.  **Start Tracking**: Go to the home screen and start your first scheduled workout, or pick any routine to start an ad-hoc session.

## Data Management

**It is highly recommended to export your data regularly as a backup.** Since all data is stored in your browser, it can be lost if you clear your browser cache or use a different device.

*   **Export**: Go to `Profile & Settings -> Data Management -> Export Data`. A JSON file containing all your data will be downloaded.
*   **Import**: Go to `Profile & Settings -> Data Management` and select the JSON backup file to restore or merge your data.

## 🛠️ Technologies Used

*   **Frontend:** [Angular](https://angular.io/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You need to have [Node.js](https://nodejs.org/) and the [Angular CLI](https://angular.io/cli) installed on your system.

```sh
npm install -g @angular/cli
```

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/fefferico/gym-app.git
    ```
2.  **Navigate to the project directory:**
    ```sh
    cd gym-app
    ```
3.  **Install NPM packages:**
    ```sh
    npm install
    ```

## 🖥️ Development Server

To start the local development server, run the following command. The application will be available at `http://localhost:4200/`.

```sh
ng serve
```

The app will automatically reload if you change any of the source files.

## 📦 Build

To build the project for production, use the following command. The build artifacts will be stored in the `dist/` directory.

```sh
ng build --prod
```

## 🧪 Running Tests

*   **Unit Tests:** To run unit tests via [Karma](https://karma-runner.github.io):
    ```sh
    ng test
    ```
*   **End-to-End (E2E) Tests:** To run end-to-end tests:
    ```sh
    ng e2e
    ```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/fefferico/gym-app/issues).

## 📄 License

This project is licensed under the MIT License - see the `LICENSE.md` file for details (if applicable).