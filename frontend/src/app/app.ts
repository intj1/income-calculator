import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { StoreService } from './store.service';
import { WasmService } from './wasm.service';
import { CalculatorFormComponent } from './calculator-form';
import { ResultsPanelComponent } from './results-panel';
import { ProjectionPageComponent } from './projection-page';
import { ComparePageComponent } from './compare-page';
import { ExplorePageComponent } from './explore-page';

type Tab = 'calculator' | 'explore' | 'projection' | 'compare' | 'about';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CalculatorFormComponent,
    ResultsPanelComponent,
    ProjectionPageComponent,
    ComparePageComponent,
    ExplorePageComponent,
  ],
  templateUrl: './app.html',
})
export class App implements OnInit {
  readonly tabs: Array<{ id: Tab; label: string }> = [
    { id: 'calculator', label: 'Calculator' },
    { id: 'explore', label: 'Explore' },
    { id: 'projection', label: 'Projection' },
    { id: 'compare', label: 'Compare' },
    { id: 'about', label: 'About' },
  ];

  readonly tab = signal<Tab>('calculator');

  constructor(
    readonly store: StoreService,
    readonly wasm: WasmService,
  ) {}

  ngOnInit(): void {
    void this.store.init();
  }

  themeIcon(): string {
    switch (this.store.theme()) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      default:
        return '🖥️';
    }
  }

  confirmReset(): void {
    if (window.confirm('Reset all inputs to defaults?')) this.store.reset();
  }
}
