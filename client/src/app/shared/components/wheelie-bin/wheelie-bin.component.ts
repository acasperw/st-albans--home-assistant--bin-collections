import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SvgSymbolService } from '../../services/svg-symbol.service';

export type WheeliBinType = 'brown' | 'black' | 'blue' | 'green' | 'black-body-blue-lid' | 'black-body-purple-lid';

@Component({
  selector: 'app-wheelie-bin',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg 
      [class]="'bin bin--' + binType" 
      viewBox="0 0 128 192" 
      role="img" 
      [attr.aria-label]="ariaLabel">
      <use href="#uk-wheelie-bin"></use>
    </svg>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
    
    .bin {
      width: 100%;
      height: 100%;
    }

    /* Brown bin */
    .bin--brown {
      --body-color: #8B4513;
      --lid-color: #8B4513;
    }

    /* Black bin */
    .bin--black {
      --body-color: #2C2C2C;
      --lid-color: #2C2C2C;
    }

    /* Blue bin */
    .bin--blue {
      --body-color: #1E3A8A;
      --lid-color: #1E3A8A;
    }

    /* Green bin */
    .bin--green {
      --body-color: #166534;
      --lid-color: #166534;
    }

    /* Black body with blue lid */
    .bin--black-body-blue-lid {
      --body-color: #2C2C2C;
      --lid-color: #1E3A8A;
    }

    /* Black body with purple lid */
    .bin--black-body-purple-lid {
      --body-color: #2C2C2C;
      --lid-color: #7C3AED;
    }
  `]
})
export class WheelieBinComponent implements OnInit {
  private svgSymbolService = inject(SvgSymbolService);

  @Input() binType: WheeliBinType = 'black';
  @Input() customAriaLabel?: string;

  ngOnInit(): void {
    this.svgSymbolService.ensureSymbolsLoaded();
  }

  get ariaLabel(): string {
    if (this.customAriaLabel) {
      return this.customAriaLabel;
    }
    
    switch (this.binType) {
      case 'brown':
        return 'Brown wheelie bin';
      case 'black':
        return 'Black wheelie bin';
      case 'blue':
        return 'Blue wheelie bin';
      case 'green':
        return 'Green wheelie bin';
      case 'black-body-blue-lid':
        return 'Black body with blue lid wheelie bin';
      case 'black-body-purple-lid':
        return 'Black body with purple lid wheelie bin';
      default:
        return 'Wheelie bin';
    }
  }
}
