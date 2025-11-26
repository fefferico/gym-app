import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TrackingService } from './tracking.service';
import { ActivityService } from './activity.service';

@Injectable({
    providedIn: 'root'
})
export class PeopleService {
    private trackingService = inject(TrackingService);
    private activityService = inject(ActivityService);

    /**
     * Returns an observable of all unique people found in both workout and activity logs.
     */
    public allPeople$: Observable<string[]> = combineLatest([
        this.trackingService.workoutLogs$,
        this.activityService.activityLogs$
    ]).pipe(
        map(([workoutLogs, activityLogs]) => {
            const peopleSet = new Set<string>();

            // From workout logs
            workoutLogs.forEach(log => {
                if (Array.isArray(log.people)) {
                    log.people.forEach(person => {
                        if (person && typeof person === 'string' && person.trim()) {
                            peopleSet.add(this.toTitleCase(person.trim()));
                        }
                    });
                }
            });

            // From activity logs
            activityLogs.forEach(log => {
                if (Array.isArray(log.people)) {
                    log.people.forEach(person => {
                        if (person && typeof person === 'string' && person.trim()) {
                            peopleSet.add(this.toTitleCase(person.trim()));
                        }
                    });
                }
            });

            return Array.from(peopleSet).sort((a, b) => a.localeCompare(b));
        })
    );

    /**
     * Returns the current list of all unique people as an array (not reactive).
     */
    public getAllPeople(): string[] {
        const workoutPeople = this.trackingService.getAllWorkoutLogs()
            .flatMap(log => log.people || [])
            .map(p => this.toTitleCase(p.trim()))
            .filter(p => !!p);

        const activityPeople = this.activityService.getAllActivityLogs()
            .flatMap(log => log.people || [])
            .map(p => this.toTitleCase(p.trim()))
            .filter(p => !!p);

        return Array.from(new Set([...workoutPeople, ...activityPeople])).sort((a, b) => a.localeCompare(b));
    }

    /**
     * Utility: Title-case a string.
     */
    private toTitleCase(str: string): string {
        return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }
}