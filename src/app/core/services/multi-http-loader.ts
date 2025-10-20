import { HttpClient } from '@angular/common/http';
import { TranslateLoader } from '@ngx-translate/core';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

export class MultiHttpLoader implements TranslateLoader {

  constructor(
    private http: HttpClient,
    private resources: { prefix: string, suffix: string }[] = [{
      prefix: '/assets/i18n/',
      suffix: '.json'
    }]
  ) {}

  /**
   * This method is called by the TranslateService to get the translations for a specific language.
   * It makes multiple HTTP requests in parallel and merges the results.
   */
  public getTranslation(lang: string): Observable<any> {
    
    // Create an array of Observables, one for each file to be fetched.
    const requests = this.resources.map(resource => {
      const path = resource.prefix + lang + resource.suffix;
      return this.http.get(path);
    });

    // Use forkJoin to wait for all requests to complete.
    return forkJoin(requests).pipe(
      // The result is an array of translation objects. We need to merge them.
      map(response => {
        // The 'reduce' function iterates over the array of responses
        // and merges each object into a single accumulator object.
        return response.reduce((acc, curr) => {
          return { ...acc, ...curr };
        }, {});
      })
    );
  }
}