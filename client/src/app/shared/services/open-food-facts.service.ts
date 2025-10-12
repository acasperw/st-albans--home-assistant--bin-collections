import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

export interface OpenFoodFactsProduct {
  code: string;
  product_name?: string;
  brands?: string;
  categories?: string;
  image_url?: string;
  image_small_url?: string;
  quantity?: string;
  nutriscore_grade?: string;
  nova_group?: number;
  ecoscore_grade?: string;
}

export interface OpenFoodFactsResponse {
  code: string;
  product?: OpenFoodFactsProduct;
  status: number;
  status_verbose: string;
}

export interface ProductInfo {
  found: boolean;
  code: string;
  name?: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  quantity?: string;
  nutriScore?: string;
}

@Injectable({ providedIn: 'root' })
export class OpenFoodFactsService {
  private http = inject(HttpClient);
  private readonly apiBase = 'https://world.openfoodfacts.org/api/v2/product';

  /**
   * Fetch product information from Open Food Facts
   */
  getProduct(barcode: string): Observable<ProductInfo> {
    console.log(`🔍 Fetching product info for barcode: ${barcode}`);
    
    const url = `${this.apiBase}/${barcode}.json`;
    
    return this.http.get<OpenFoodFactsResponse>(url).pipe(
      tap(response => {
        console.log('📦 Open Food Facts response:', response);
      }),
      map(response => this.transformResponse(response)),
      catchError(error => {
        console.error('❌ Error fetching product from Open Food Facts:', error);
        return of({
          found: false,
          code: barcode
        });
      })
    );
  }

  /**
   * Transform API response to our simpler format
   */
  private transformResponse(response: OpenFoodFactsResponse): ProductInfo {
    if (response.status !== 1 || !response.product) {
      return {
        found: false,
        code: response.code
      };
    }

    const product = response.product;
    
    // Combine product name and brand for a better display name
    let name = product.product_name || '';
    if (product.brands && !name.toLowerCase().includes(product.brands.toLowerCase())) {
      name = product.brands + (name ? ' - ' + name : '');
    }

    // Extract primary category
    const category = product.categories?.split(',')[0]?.trim();

    return {
      found: true,
      code: response.code,
      name: name || undefined,
      brand: product.brands || undefined,
      category: category || undefined,
      imageUrl: product.image_url || product.image_small_url || undefined,
      quantity: product.quantity || undefined,
      nutriScore: product.nutriscore_grade?.toUpperCase() || undefined
    };
  }
}
