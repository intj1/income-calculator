import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StoreService } from './store.service';
import { DonutChartComponent, DonutSlice } from './charts/donut-chart';
import { BracketChartComponent } from './charts/bracket-chart';
import { WaterfallChartComponent } from './charts/waterfall-chart';
import { SankeyChartComponent } from './charts/sankey-chart';
import { FreedomTimelineComponent } from './charts/freedom-timeline';
import { money, moneyExact, pct } from './format';
import { PeriodAmounts } from './models';

interface PeriodRow {
  label: string;
  gross: number;
  tax: number;
  net: number;
}

type PaycheckFreq = 'monthly' | 'semimonthly' | 'biweekly' | 'weekly';

const PAYCHECKS_PER_YEAR: Record<PaycheckFreq, number> = {
  monthly: 12,
  semimonthly: 24,
  biweekly: 26,
  weekly: 52,
};

@Component({
  selector: 'app-results-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DonutChartComponent,
    BracketChartComponent,
    WaterfallChartComponent,
    SankeyChartComponent,
    FreedomTimelineComponent,
    FormsModule,
  ],
  templateUrl: './results-panel.html',
  styleUrl: './results-panel.scss',
})
export class ResultsPanelComponent {
  readonly desiredMonthlyNet = signal(0);
  readonly paycheckFreq = signal<PaycheckFreq>('biweekly');

  constructor(readonly store: StoreService) {}

  readonly solveResult = computed(() => {
    const desired = this.desiredMonthlyNet();
    if (desired <= 0) return null;
    return this.store.solveRequiredGross(desired * 12);
  });

  readonly firstIncomeLabel = computed(
    () => this.store.input().incomes[0]?.label || 'first income source',
  );

  setDesired(value: unknown): void {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    this.desiredMonthlyNet.set(isFinite(n) && n > 0 ? n : 0);
  }

  perCheck(annual: number): number {
    return annual / PAYCHECKS_PER_YEAR[this.paycheckFreq()];
  }

  nonzero(lines: { label: string; annual: number }[]): { label: string; annual: number }[] {
    return lines.filter((l) => l.annual > 0.005);
  }

  // Color follows the entity (fixed slot per category), never its rank.
  readonly donutSlices = computed<DonutSlice[]>(() => {
    const out = this.store.output();
    if (!out) return [];
    return [
      { label: 'Take-home', value: out.net_annual, colorVar: '--series-1' },
      {
        label: 'Federal tax',
        value: out.federal_tax + out.self_employment_tax,
        colorVar: '--series-2',
      },
      { label: 'FICA', value: out.fica.total, colorVar: '--series-3' },
      { label: 'State tax', value: out.state_tax.tax, colorVar: '--series-4' },
      { label: 'Pre-tax savings', value: out.pretax_total, colorVar: '--series-5' },
      { label: 'Post-tax deductions', value: out.posttax_total, colorVar: '--series-6' },
    ];
  });

  readonly periodRows = computed<PeriodRow[]>(() => {
    const out = this.store.output();
    if (!out) return [];
    const pick = (p: PeriodAmounts) =>
      [p.annually, p.monthly, p.semimonthly, p.biweekly, p.weekly, p.daily, p.hourly];
    const labels = [
      'Annual',
      'Monthly',
      'Semi-monthly',
      'Biweekly',
      'Weekly',
      'Daily',
      'Hourly',
    ];
    const gross = pick(out.gross_periods);
    const tax = pick(out.tax_periods);
    const net = pick(out.net_periods);
    return labels.map((label, i) => ({ label, gross: gross[i], tax: tax[i], net: net[i] }));
  });

  print(): void {
    window.print();
  }

  fmtMoney = money;
  fmtMoneyExact = moneyExact;
  fmtPct = pct;
}
