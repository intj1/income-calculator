import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { StoreService } from './store.service';
import { CalculatorFormComponent } from './calculator-form';
import { CompareBarsChartComponent } from './charts/compare-bars-chart';
import { money, pct } from './format';

interface CompareRow {
  label: string;
  a: number;
  b: number;
  isPct?: boolean;
  /** Whether a higher B value is good (net) or bad (tax). */
  higherIsBetter: boolean;
}

@Component({
  selector: 'app-compare-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalculatorFormComponent, CompareBarsChartComponent],
  template: `
    @if (!store.scenarioB()) {
      <section class="card">
        <h2>Scenario comparison</h2>
        <p class="muted">
          Compare your current setup against a what-if: a raise, a move to another state,
          a different 401(k) rate, going freelance…
        </p>
        <button type="button" class="btn" (click)="store.startComparison()">
          Duplicate current scenario as “Scenario B”
        </button>
      </section>
    } @else {
      <section class="card">
        <header class="card-head">
          <h2>Scenario A vs B</h2>
          <button type="button" class="btn danger sm" (click)="store.clearComparison()">
            Remove comparison
          </button>
        </header>
        @if (store.output(); as a) {
          @if (store.outputB(); as b) {
            <app-compare-bars-chart [outputA]="a" [outputB]="b" />
          }
        }
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th></th><th class="num">A (current)</th><th class="num">B (what-if)</th><th class="num">Δ B−A</th></tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.label) {
                <tr>
                  <td>{{ row.label }}</td>
                  <td class="num">{{ fmt(row, row.a) }}</td>
                  <td class="num">{{ fmt(row, row.b) }}</td>
                  <td class="num" [class.delta-good]="isGood(row)" [class.delta-bad]="isBad(row)">
                    {{ delta(row) }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      <h3 class="section-label">Edit Scenario B</h3>
      <app-calculator-form scenario="B" />
    }
  `,
  styles: `
    .muted {
      color: var(--text-muted);
      font-size: 0.85rem;
    }
    .section-label {
      margin: 1.5rem 0 0.5rem;
      color: var(--text-secondary);
      font-size: 0.95rem;
    }
    .delta-good { color: var(--delta-good); font-weight: 600; }
    .delta-bad { color: var(--delta-bad); font-weight: 600; }
  `,
})
export class ComparePageComponent {
  constructor(readonly store: StoreService) {}

  readonly rows = computed<CompareRow[]>(() => {
    const a = this.store.output();
    const b = this.store.outputB();
    if (!a || !b) return [];
    return [
      { label: 'Gross income', a: a.gross.total_annual, b: b.gross.total_annual, higherIsBetter: true },
      { label: 'Total tax', a: a.total_tax, b: b.total_tax, higherIsBetter: false },
      { label: 'Federal income tax', a: a.federal_tax, b: b.federal_tax, higherIsBetter: false },
      { label: 'State tax', a: a.state_tax.tax, b: b.state_tax.tax, higherIsBetter: false },
      { label: 'FICA + SE tax', a: a.fica.total + a.self_employment_tax, b: b.fica.total + b.self_employment_tax, higherIsBetter: false },
      { label: 'Net income (annual)', a: a.net_annual, b: b.net_annual, higherIsBetter: true },
      { label: 'Net income (monthly)', a: a.net_periods.monthly, b: b.net_periods.monthly, higherIsBetter: true },
      { label: 'Effective tax rate', a: a.rates.effective_total, b: b.rates.effective_total, isPct: true, higherIsBetter: false },
      { label: 'Take-home %', a: a.rates.take_home_percent, b: b.rates.take_home_percent, isPct: true, higherIsBetter: true },
    ];
  });

  fmt(row: CompareRow, v: number): string {
    return row.isPct ? pct(v) : money(v);
  }

  delta(row: CompareRow): string {
    const d = row.b - row.a;
    const sign = d > 0 ? '+' : '';
    return sign + (row.isPct ? pct(d) : money(d));
  }

  isGood(row: CompareRow): boolean {
    const d = row.b - row.a;
    return Math.abs(d) > 1e-9 && d > 0 === row.higherIsBetter;
  }

  isBad(row: CompareRow): boolean {
    const d = row.b - row.a;
    return Math.abs(d) > 1e-9 && d > 0 !== row.higherIsBetter;
  }
}
