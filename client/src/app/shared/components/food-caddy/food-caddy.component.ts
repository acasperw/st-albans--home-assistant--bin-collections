import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SvgSymbolService } from '../../services/svg-symbol.service';

export type FoodCaddyType = 'green' | 'black-body-green-lid';

@Component({
  selector: 'app-food-caddy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg 
      [class]="'caddy caddy--' + caddyType" 
      role="img" 
      [attr.aria-label]="ariaLabel" 
      viewBox="0 0 128 128">
      <use href="#uk-food-caddy"></use>
    </svg>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    
    .caddy {
      width: 100%;
      height: 100%;
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
