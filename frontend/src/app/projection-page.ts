import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StoreService } from './store.service';
import { WasmService } from './wasm.service';
import { ProjectionChartComponent } from './charts/projection-chart';
import { RothTradChartComponent } from './charts/roth-trad-chart';
import { RothTradInput, defaultRothTradInput } from './models';
import { money, pct } from './format';

@Component({
  selector: 'app-projection-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ProjectionChartComponent, RothTradChartComponent],
  templateUrl: './projection-page.html',
  styleUrl: './projection-page.scss',
})
export class ProjectionPageComponent {
  readonly rt = signal<RothTradInput>(defaultRothTradInput());

  constructor(
    readonly store: StoreService,
    private wasm: WasmService,
  ) {}

  readonly rothTradOut = computed(() => {
    if (!this.wasm.ready()) return null;
    try {
      return this.wasm.rothVsTraditional(this.rt());
    } catch {
      return null;
    }
  });

  readonly myMarginal = computed(() => {
    const out = this.store.output();
    if (!out) return null;
    return out.rates.marginal_federal + out.rates.marginal_state;
  });

  useMyMarginal(): void {
    const m = this.myMarginal();
    if (m !== null) this.setRt('current_marginal_rate_percent', Math.round(m * 10000) / 100);
  }

  setRt(field: keyof RothTradInput, value: unknown, integer = false): void {
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    const safe = !isFinite(n) || n < 0 ? 0 : integer ? Math.floor(n) : n;
    this.rt.set({ ...this.rt(), [field]: safe });
  }

  abs = Math.abs;
  fmtPct = (v: number) => pct(v, 1);

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
