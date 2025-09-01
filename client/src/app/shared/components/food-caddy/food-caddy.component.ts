import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SvgSymbolService } from '../../services/svg-symbol.service';

export type FoodCaddyType = 'green' | 'black-body-green-lid';

/**
 * FoodCaddyComponent - A reusable SVG food caddy component
 * 
 * @Input caddyType - The color/style of the caddy
 * @Input customAriaLabel - Optional custom accessibility label
 * @Input icon - Optional icon (emoji or text) to display centrally over the caddy
 * 
 * Usage:
 * <app-food-caddy caddyType="green" icon="🍎"></app-food-caddy>
 */

@Component({
  selector: 'app-food-caddy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="caddy-container">
      <svg 
        [class]="'caddy caddy--' + caddyType" 
        role="img" 
        [attr.aria-label]="ariaLabel" 
        viewBox="0 0 128 128">
        <use href="#uk-food-caddy"></use>
      </svg>
      @if (icon) {
        <div class="caddy-icon-overlay">{{ icon }}</div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    
    .caddy-container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    
    .caddy {
      width: 100%;
      height: 100%;
    }

    .caddy-icon-overlay {
      position: absolute;
      top: 70%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 3rem;
      z-index: 10;
      pointer-events: none;
      text-shadow: 0 0 3px rgba(255, 255, 255, 0.8);
    }

    /* Green caddy */
    .caddy--green {
      --body-color: #166534;
      --lid-color: #166534;
    }

    /* Black body with green lid */
    .caddy--black-body-green-lid {
      --body-color: #2C2C2C;
      --lid-color: #166534;
    }
  `]
})
export class FoodCaddyComponent implements OnInit {
  private svgSymbolService = inject(SvgSymbolService);

  @Input() caddyType: FoodCaddyType = 'green';
  @Input() customAriaLabel?: string;
  @Input() icon?: string;

  ngOnInit(): void {
    this.svgSymbolService.ensureSymbolsLoaded();
  }

  get ariaLabel(): string {
    if (this.customAriaLabel) {
      return this.customAriaLabel;
    }

    switch (this.caddyType) {
      case 'green':
        return 'Green food caddy';
      case 'black-body-green-lid':
        return 'Black body with green lid food caddy';
      default:
        return 'Food caddy';
    }
  }
}
