import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StoreService } from './store.service';
import { ProjectionChartComponent } from './charts/projection-chart';
import { money } from './format';

@Component({
  selector: 'app-projection-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ProjectionChartComponent],
  template: `
    <section class="card">
      <h2>Savings & investment projection</h2>
      <p class="muted">
        Project what saving part of your take-home grows into, with compound returns,
        annual raises, and inflation-adjusted purchasing power.
      </p>
      <div class="grid-3">
        <label>
          <span>Starting balance ($)</span>
          <input type="number" min="0" [ngModel]="store.projection().current_balance" (ngModelChange)="set('current_balance', $event)" />
        </label>
        <label>
          <span>Annual contribution ($)</span>
          <input type="number" min="0" [ngModel]="store.projection().annual_contribution" (ngModelChange)="set('annual_contribution', $event)" />
        </label>
        <label>
          <span>Annual return (%)</span>
          <input type="number" min="0" max="30" step="0.5" [ngModel]="store.projection().annual_return_percent" (ngModelChange)="set('annual_return_percent', $event)" />
        </label>
        <label>
          <span>Inflation (%)</span>
          <input type="number" min="0" max="20" step="0.5" [ngModel]="store.projection().inflation_percent" (ngModelChange)="set('inflation_percent', $event)" />
        </label>
        <label>
          <span>Contribution growth (%/yr)</span>
          <input type="number" min="0" max="20" step="0.5" [ngModel]="store.projection().contribution_growth_percent" (ngModelChange)="set('contribution_growth_percent', $event)" />
        </label>
        <label>
          <span>Years</span>
          <input type="number" min="1" max="60" [ngModel]="store.projection().years" (ngModelChange)="set('years', $event, true)" />
        </label>
        <label>
          <span>Return volatility (% std dev)</span>
          <input type="number" min="0" max="50" step="1" [ngModel]="store.projection().return_volatility_percent" (ngModelChange)="set('return_volatility_percent', $event)" />
        </label>
        <label>
          <span>Target balance ($, e.g. FIRE number)</span>
          <input type="number" min="0" [ngModel]="store.projection().target_balance" (ngModelChange)="set('target_balance', $event)" />
        </label>
      </div>
      <p class="fine">
        Volatility > 0 adds a Monte Carlo simulation (500 market paths) — the shaded band shows the
        10th–90th percentile outcomes. Rule of thumb for a retirement target: 25× your desired
        annual spending (the 4% rule).
      </p>
      @if (store.output(); as out) {
        <button type="button" class="btn ghost" (click)="useBudgetSavings()">
          Use my 20% budget savings ({{ fmtMoney(out.budget.monthly_savings * 12) }}/yr)
        </button>
      }
    </section>

    @if (store.projectionOutput(); as proj) {
      <section class="card">
        <div class="stat-row">
          <div class="stat">
            <span class="stat-num">{{ fmtMoney(proj.final_balance) }}</span>
            <span class="stat-cap">Final balance</span>
          </div>
          <div class="stat">
            <span class="stat-num">{{ fmtMoney(proj.final_real_balance) }}</span>
            <span class="stat-cap">In today's dollars</span>
          </div>
          <div class="stat">
            <span class="stat-num">{{ fmtMoney(proj.total_contributed) }}</span>
            <span class="stat-cap">Total contributed</span>
          </div>
          <div class="stat">
            <span class="stat-num">{{ fmtMoney(proj.total_interest) }}</span>
            <span class="stat-cap">Total growth</span>
          </div>
          @if (store.projection().target_balance > 0) {
            <div class="stat">
              <span class="stat-num">
                {{ proj.target_year_reached !== null ? 'Year ' + proj.target_year_reached : 'Not reached' }}
              </span>
              <span class="stat-cap">Target hit (expected path)</span>
            </div>
            @if (store.projection().return_volatility_percent > 0) {
              <div class="stat">
                <span class="stat-num">{{ (proj.target_probability * 100).toFixed(0) }}%</span>
                <span class="stat-cap">Chance of reaching target</span>
              </div>
            }
          }
        </div>
        <app-projection-chart [years]="proj.years" [target]="store.projection().target_balance" />
      </section>
    }
  `,
  styles: `
    .fine {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .muted {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 0;
    }
    .stat-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .stat {
      background: var(--chip-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.8rem;
      display: grid;
      gap: 0.15rem;
    }
    .stat-num {
      font-size: 1.15rem;
      font-weight: 650;
      color: var(--text-primary);
    }
    .stat-cap {
      font-size: 0.72rem;
      color: var(--text-muted);
    }
  `,
})
export class ProjectionPageComponent {
  constructor(readonly store: StoreService) {}

  set(field: string, value: unknown, integer = false): void {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    const safe = !isFinite(n) || n < 0 ? 0 : integer ? Math.floor(n) : n;
    this.store.projection.set({
      ...this.store.projection(),
      [field]: safe,
    });
  }

  useBudgetSavings(): void {
    const out = this.store.output();
    if (out) this.set('annual_contribution', out.budget.monthly_savings * 12);
  }

  fmtMoney = money;
}
