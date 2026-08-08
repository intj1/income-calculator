import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { StoreService } from './store.service';
import { WasmService } from './wasm.service';
import { CalculatorFormComponent } from './calculator-form';
import { ResultsPanelComponent } from './results-panel';
import { ProjectionPageComponent } from './projection-page';
import { ComparePageComponent } from './compare-page';

type Tab = 'calculator' | 'projection' | 'compare' | 'about';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CalculatorFormComponent,
    ResultsPanelComponent,
    ProjectionPageComponent,
    ComparePageComponent,
  ],
  template: `
    <header class="topbar">
      <div class="topbar-inner">
        <h1>💵 Income Calculator</h1>
        <nav class="tabs" role="tablist">
          @for (t of tabs; track t.id) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="tab() === t.id"
              [class.active]="tab() === t.id"
              (click)="tab.set(t.id)"
            >
              {{ t.label }}
            </button>
          }
        </nav>
        <div class="topbar-actions">
          <button type="button" class="btn ghost sm" (click)="store.cycleTheme()" [attr.aria-label]="'Theme: ' + store.theme()">
            {{ themeIcon() }} {{ store.theme() }}
          </button>
          <button type="button" class="btn ghost sm" (click)="confirmReset()">Reset</button>
        </div>
      </div>
    </header>

    <main class="page">
      @if (wasm.loadError(); as err) {
        <section class="card">
          <h2>Failed to load the calculation engine</h2>
          <p>The WebAssembly module could not be loaded: {{ err }}</p>
        </section>
      } @else {
        @switch (tab()) {
          @case ('calculator') {
            <div class="two-col">
              <div class="col-form"><app-calculator-form scenario="A" /></div>
              <div class="col-results"><app-results-panel /></div>
            </div>
          }
          @case ('projection') {
            <app-projection-page />
          }
          @case ('compare') {
            <app-compare-page />
          }
          @case ('about') {
            <section class="card about">
              <h2>About</h2>
              <p>
                A fully client-side income calculator. All tax math runs in your browser via a
                Rust calculation engine compiled to WebAssembly — nothing you type ever leaves
                this page.
              </p>
              <h3>What it models (US, tax years 2024–2026)</h3>
              <ul>
                <li>Selectable tax year with year-accurate brackets, deductions, and contribution limits — including the OBBBA changes (2025+ standard deductions, $2,200 child tax credit, tips & overtime-premium deductions)</li>
                <li>Take-home target solver: enter a desired monthly net and get the required salary</li>
                <li>Insights: unclaimed employer match, 401(k)/HSA headroom with estimated tax savings</li>
                <li>Monte Carlo savings projections (10th–90th percentile bands) with a FIRE-style target line and probability of success</li>
                <li>Shareable scenario links (everything stays in the URL — nothing is uploaded)</li>
                <li>Multiple income sources: salary, hourly (with overtime), bonus, commission, tips, self-employment, rental, interest</li>
                <li>All pay frequencies: hourly → annual, with per-period take-home tables</li>
                <li>Federal brackets, standard/itemized deduction, all four filing statuses</li>
                <li>FICA: Social Security wage base, Medicare and Additional Medicare</li>
                <li>Self-employment tax with W-2 wage-base coordination and the ½ SE deduction</li>
                <li>Long-term capital gains and qualified dividends with bracket stacking, plus NIIT</li>
                <li>Child tax credit and other-dependent credit with AGI phase-out</li>
                <li>Pre-tax benefits: 401(k) with employer match and IRS limits, IRA, HSA, FSA, insurance, commuter — with correct FICA treatment of cafeteria-plan items</li>
                <li>Post-tax: Roth 401(k)/IRA (shared limits), garnishments, dues</li>
                <li>State income tax for all 50 states + DC (real brackets for CA and NY, exact flat rates where applicable, labeled approximations elsewhere)</li>
                <li>Employer's true cost of employment (employer FICA, FUTA, match)</li>
                <li>50/30/20 budget, savings projection with compound growth and inflation, scenario A/B comparison, CSV/JSON export</li>
              </ul>
              <h3>Disclaimer</h3>
              <p class="fine">
                Estimates for planning purposes only — not tax, legal, or financial advice.
                State calculations are simplified (state-specific credits, local taxes, and
                some deductions are not modeled). Consult a professional for filing decisions.
              </p>
            </section>
          }
        }
      }
    </main>

    <footer class="footer">
      <span>Rust + WebAssembly engine · Angular UI · runs 100% in your browser</span>
    </footer>
  `,
})
export class App implements OnInit {
  readonly tabs: Array<{ id: Tab; label: string }> = [
    { id: 'calculator', label: 'Calculator' },
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
