import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-next-bin-collection',
  imports: [],
  templateUrl: './next-bin-collection.html'
})
export class NextBinCollection {

  private http = inject(HttpClient);

  ngOnInit(): void {
    this.fetchCollectionDates();
  }

  private fetchCollectionDates(): void {
    const apiUrl = `${environment.apiBaseUrl}/api/bin-collection`;
    this.http.get(apiUrl).subscribe({
      next: (data) => {
        console.log('Bin collection dates:', data);
      },
      error: (error) => {
        console.error('Error fetching bin collection dates:', error);
      }
    });
  }

}
