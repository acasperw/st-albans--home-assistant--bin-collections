import { Injectable, inject, DOCUMENT } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SvgSymbolService {
  private document = inject(DOCUMENT);
  private symbolsAdded = new Set<string>();

  /**
   * Adds SVG symbol definitions to the document if not already present
   */
  public ensureSymbolsLoaded(): void {
    if (!this.symbolsAdded.has('uk-wheelie-bin')) {
      this.addWheelieBinSymbol();
      this.symbolsAdded.add('uk-wheelie-bin');
    }

    if (!this.symbolsAdded.has('uk-food-caddy')) {
      this.addFoodCaddySymbol();
      this.symbolsAdded.add('uk-food-caddy');
    }
  }

  private addWheelieBinSymbol(): void {
    const svgContainer = this.getOrCreateHiddenSvgContainer();
    
    const symbol = this.document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    symbol.setAttribute('id', 'uk-wheelie-bin');
    symbol.setAttribute('viewBox', '0 0 78 128');
    
    symbol.innerHTML = `
      <g transform="translate(-25 -29)">
        <!-- LID -->
        <g class="bin-lid" fill="var(--lid-color,currentColor)"
           stroke="rgba(0,0,0,.25)" stroke-width="1"
           stroke-linejoin="round" vector-effect="non-scaling-stroke">
          <rect x="26" y="36" width="76" height="12" rx="4"/>
          <rect x="30" y="32" width="68" height="6" rx="3"/>
        </g>

        <!-- BODY -->
        <g class="bin-body" fill="var(--body-color,currentColor)"
           stroke="rgba(0,0,0,.25)" stroke-width="1"
           stroke-linejoin="round" vector-effect="non-scaling-stroke">
          <path d="M30 48H98L90 156H38Z"/>
          <rect x="36" y="70" width="56" height="74" rx="6"
                fill="rgba(0,0,0,.06)" stroke="none"/>
          <rect x="36" y="56" width="40" height="6" rx="3"
                fill="rgba(255,255,255,.18)" stroke="none"/>
        </g>
      </g>
    `;
    
    svgContainer.appendChild(symbol);
  }

  private addFoodCaddySymbol(): void {
    const svgContainer = this.getOrCreateHiddenSvgContainer();
    
    const symbol = this.document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    symbol.setAttribute('id', 'uk-food-caddy');
    symbol.setAttribute('viewBox', '0 0 74 111');
    
    symbol.innerHTML = `
      <g transform="translate(-27 6)">
        <!-- LID -->
        <g class="caddy-lid" fill="var(--lid-color,currentColor)"
           stroke="rgba(0,0,0,.25)" stroke-width="1"
           stroke-linejoin="round" vector-effect="non-scaling-stroke">
          <rect x="28" y="20" width="72" height="12" rx="4"/>
          <rect x="32" y="16" width="64" height="6" rx="3"/>
        </g>

        <!-- BODY -->
        <g class="caddy-body" fill="var(--body-color,currentColor)"
           stroke="rgba(0,0,0,.25)" stroke-width="1"
           stroke-linejoin="round" vector-effect="non-scaling-stroke">
          <path d="M32 32H96L88 104H40Z"/>
          <rect x="40" y="50" width="48" height="46" rx="6"
                fill="rgba(0,0,0,.06)" stroke="none"/>
          <rect x="40" y="40" width="32" height="6" rx="3"
                fill="rgba(255,255,255,.18)" stroke="none"/>
        </g>
      </g>
    `;
    
    svgContainer.appendChild(symbol);
  }

  private createHiddenSvgContainer(): SVGElement {
    const svg = this.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    svg.setAttribute('id', 'svg-symbols-container');
    
    this.document.body.appendChild(svg);
    return svg;
  }

  private getOrCreateHiddenSvgContainer(): SVGElement {
    let container = this.document.getElementById('svg-symbols-container') as SVGElement | null;
    if (!container) {
      container = this.createHiddenSvgContainer();
    }
    return container;
  }
}
