import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { StoreService } from './store.service';
import { IncomeCurveChartComponent } from './charts/income-curve-chart';
import { StateBarsChartComponent } from './charts/state-bars-chart';
import { K401CurveChartComponent } from './charts/k401-curve-chart';
import { MarriageChartComponent } from './charts/marriage-chart';
import { money } from './format';

@Component({
  selector: 'app-explore-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IncomeCurveChartComponent,
    StateBarsChartComponent,
    K401CurveChartComponent,
    MarriageChartComponent,
  ],
  templateUrl: './explore-page.html',
  styleUrl: './explore-page.scss',
})
export class ExplorePageComponent {
  constructor(readonly store: StoreService) {}

  readonly currentAmount = computed(() => this.store.input().incomes[0]?.amount ?? 0);

  readonly hasWages = computed(() => {
    const out = this.store.output();
    return !!out && out.gross.wage_annual > 0;
  });

  /** The marriage what-if only makes sense when not already filing jointly. */
  readonly showMarriage = computed(
    () => this.store.input().filing_status !== 'married_joint' && this.hasWages(),
  );

  /** Marginal value of the next +5% of 401(k) contribution. */
  readonly plusOneInsight = computed(() => {
    const curve = this.store.k401Curve();
    if (curve.length < 2) return null;
    const current = Math.round(this.store.input().pretax.k401_percent);
    const from = curve.reduce((best, p) =>
      Math.abs(p.percent - current) < Math.abs(best.percent - current) ? p : best,
    );
    const toPercent = from.percent + 5;
    const to = curve.find((p) => p.percent >= toPercent);
    if (!to || to.percent === from.percent) return null;
    const netCost = from.net_annual - to.net_annual;
    const retirementGain = to.retirement_total - from.retirement_total;
    if (netCost <= 0 || retirementGain <= 0) return null;
    return {
      from: from.percent.toFixed(0),
      to: to.percent.toFixed(0),
      netCost,
      retirementGain,
      ratio: retirementGain / netCost,
    };
  });

  readonly bestMove = computed(() => {
    const sweep = this.store.stateSweep();
    const code = this.store.input().state;
    const current = sweep.find((e) => e.code === code);
    if (!current || sweep.length === 0) return null;
    const best = sweep[0];
    const delta = best.net_annual - current.net_annual;
    if (delta < 1) return null;
    return { fromName: current.name, delta };
  });

  fmtMoney = money;
}
