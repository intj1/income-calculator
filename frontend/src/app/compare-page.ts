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
  templateUrl: './compare-page.html',
  styleUrl: './compare-page.scss',
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
