import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { StoreService } from './store.service';
import { IncomeCurveChartComponent } from './charts/income-curve-chart';
import { StateBarsChartComponent } from './charts/state-bars-chart';
import { K401CurveChartComponent } from './charts/k401-curve-chart';
import { money } from './format';

@Component({
  selector: 'app-explore-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IncomeCurveChartComponent, StateBarsChartComponent, K401CurveChartComponent],
  template: `
    <section class="card">
      <h2>How your take-home scales</h2>
      <p class="muted">
        Your exact scenario — filing status, state, deductions — recomputed at every income level
        from $0 to 2.5× your current pay. The gap between the dashed line and the blue line is
        everything you pay in taxes; the stair-steps in the marginal line are the tax brackets.
      </p>
      @if (store.incomeCurve().length) {
        <app-income-curve-chart
          [curve]="store.incomeCurve()"
          [currentAmount]="currentAmount()"
        />
      } @else {
        <p class="muted">Loading…</p>
      }
    </section>

    @if (hasWages()) {
      <section class="card">
        <h2>401(k) contribution optimizer</h2>
        <p class="muted">
          What happens to this year's money as you raise your traditional 401(k) contribution:
          take-home falls, but retirement dollars (including any employer match and the tax
          deferral) rise faster — until the IRS limit flattens the curve.
        </p>
        @if (store.k401Curve().length) {
          <app-k401-curve-chart
            [curve]="store.k401Curve()"
            [currentPercent]="store.input().pretax.k401_percent"
          />
          @if (plusOneInsight(); as ins) {
            <p class="muted takeaway">
              Going from {{ ins.from }}% to {{ ins.to }}% would cost
              <strong class="cost">{{ fmtMoney(ins.netCost) }}</strong> of take-home but add
              <strong>{{ fmtMoney(ins.retirementGain) }}</strong> to retirement — every dollar
              given up becomes {{ ins.ratio.toFixed(2) }} dollars saved.
            </p>
          }
        }
      </section>
    }

    <section class="card">
      <h2>Your net income in every state</h2>
      @if (store.stateSweep().length) {
        <app-state-bars-chart [sweep]="store.stateSweep()" [currentState]="store.input().state" />
        @if (bestMove(); as move) {
          <p class="muted takeaway">
            Moving from {{ move.fromName }} to a no-income-tax state would keep
            <strong>{{ fmtMoney(move.delta) }}</strong> more per year in your pocket.
          </p>
        }
      } @else {
        <p class="muted">Loading…</p>
      }
    </section>
  `,
  styles: `
    .muted {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 0;
    }
    .takeaway {
      margin-top: 0.75rem;
    }
    .takeaway strong {
      color: var(--delta-good);
    }
    .takeaway strong.cost {
      color: var(--delta-bad);
    }
  `,
})
export class ExplorePageComponent {
  constructor(readonly store: StoreService) {}

  readonly currentAmount = computed(() => this.store.input().incomes[0]?.amount ?? 0);

  readonly hasWages = computed(() => {
    const out = this.store.output();
    return !!out && out.gross.wage_annual > 0;
  });

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
