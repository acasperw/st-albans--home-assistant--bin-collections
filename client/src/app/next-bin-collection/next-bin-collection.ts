import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BinCollectionService } from './bin-collection';

@Component({
  selector: 'app-next-bin-collection',
  imports: [
    CommonModule
  ],
  templateUrl: './next-bin-collection.html'
})
export class NextBinCollection implements OnInit {

  private binCollectionService = inject(BinCollectionService);

  // Expose service signals to template
  public loading = this.binCollectionService.loading;
  public errorMessage = this.binCollectionService.errorMessage;
  public enhancedGroupedCollections = this.binCollectionService.enhancedGroupedCollections;

  ngOnInit(): void {
    this.binCollectionService.initializeAutoRefresh();
  }
}
