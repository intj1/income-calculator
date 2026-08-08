import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { StoreService } from './store.service';
import { IncomeCurveChartComponent } from './charts/income-curve-chart';
import { StateBarsChartComponent } from './charts/state-bars-chart';
import { money } from './format';

@Component({
  selector: 'app-explore-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IncomeCurveChartComponent, StateBarsChartComponent],
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
  `,
})
export class ExplorePageComponent {
  constructor(readonly store: StoreService) {}

  readonly currentAmount = computed(() => this.store.input().incomes[0]?.amount ?? 0);

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
