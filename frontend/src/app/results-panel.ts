import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StoreService } from './store.service';
import { DonutChartComponent, DonutSlice } from './charts/donut-chart';
import { BracketChartComponent } from './charts/bracket-chart';
import { WaterfallChartComponent } from './charts/waterfall-chart';
import { SankeyChartComponent } from './charts/sankey-chart';
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
    FormsModule,
  ],
  template: `
    @if (store.output(); as out) {
      <section class="card hero-card">
        <div class="hero">
          <div class="hero-main">
            <span class="hero-label">Take-home pay · {{ out.tax_year }} tax year</span>
            <span class="hero-value">{{ fmtMoney(out.net_annual) }}<span class="hero-per">/yr</span></span>
            <span class="hero-sub">
              {{ fmtMoney(out.net_periods.monthly) }}/mo · {{ fmtMoneyExact(out.net_periods.biweekly) }} per biweekly check
            </span>
          </div>
          <div class="hero-chips">
            <span class="chip">Keep {{ fmtPct(out.rates.take_home_percent) }} of gross</span>
            <span class="chip">Effective tax {{ fmtPct(out.rates.effective_total) }}</span>
            <span class="chip">Marginal federal {{ fmtPct(out.rates.marginal_federal, 0) }}</span>
            @if (out.rates.marginal_state > 0) {
              <span class="chip">Marginal state {{ fmtPct(out.rates.marginal_state) }}</span>
            }
          </div>
        </div>
        <div class="actions">
          <button type="button" class="btn ghost" (click)="store.copyShareLink()">
            {{ store.shareCopied() ? '✓ Copied!' : 'Share link' }}
          </button>
          <button type="button" class="btn ghost" (click)="store.exportJson()">Export JSON</button>
          <button type="button" class="btn ghost" (click)="store.exportCsv()">Export CSV</button>
          <button type="button" class="btn ghost" (click)="print()">Print</button>
        </div>
      </section>

      @if (out.insights.length) {
        <section class="card">
          <h2>💡 Insights</h2>
          <ul class="insights">
            @for (ins of out.insights; track ins.title) {
              <li>
                <div class="insight-head">
                  <strong>{{ ins.title }}</strong>
                  <span class="insight-value">≈ {{ fmtMoney(ins.annual_value) }}/yr</span>
                </div>
                <span class="insight-detail">{{ ins.detail }}</span>
              </li>
            }
          </ul>
        </section>
      }

      <section class="card">
        <h2>What do I need to earn?</h2>
        <div class="solver-row">
          <label>
            <span>Desired take-home ($/month)</span>
            <input type="number" min="0" [ngModel]="desiredMonthlyNet()" (ngModelChange)="setDesired($event)" />
          </label>
          @if (solveResult(); as solved) {
            <div class="solver-answer">
              <span class="solver-num">{{ fmtMoney(solved.required_amount) }}</span>
              <span class="solver-cap">
                required on "{{ firstIncomeLabel() }}" ({{ fmtMoney(solved.required_gross_annual) }} total gross)
              </span>
            </div>
          } @else if (desiredMonthlyNet() > 0) {
            <span class="solver-cap">Solving…</span>
          }
        </div>
        <p class="fine">
          Holds your current state, deductions, and other income fixed; solves the first income
          source's amount.
        </p>
      </section>

      @if (out.warnings.length) {
        <section class="card warnings">
          <h2>Notes</h2>
          <ul>
            @for (w of out.warnings; track w) {
              <li>{{ w }}</li>
            }
          </ul>
        </section>
      }

      <section class="card">
        <h2>Money flow</h2>
        <app-sankey-chart [output]="out" />
      </section>

      <section class="card">
        <h2>Where the money goes</h2>
        <app-donut-chart [slices]="donutSlices()" />
      </section>

      <section class="card">
        <h2>From gross to net</h2>
        <app-waterfall-chart [output]="out" />
      </section>

      <section class="card">
        <h2>Pay periods</h2>
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>Period</th><th>Gross</th><th>Taxes</th><th>Net</th></tr>
            </thead>
            <tbody>
              @for (row of periodRows(); track row.label) {
                <tr>
                  <td>{{ row.label }}</td>
                  <td class="num">{{ fmtMoneyExact(row.gross) }}</td>
                  <td class="num">{{ fmtMoneyExact(row.tax) }}</td>
                  <td class="num strong">{{ fmtMoneyExact(row.net) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      @if (out.federal_brackets.length) {
        <section class="card">
          <h2>Federal brackets</h2>
          <app-bracket-chart [brackets]="out.federal_brackets" />
        </section>
      }

      <section class="card">
        <h2>Tax detail</h2>
        <div class="table-scroll">
          <table>
            <tbody>
              <tr><td>Gross income</td><td class="num">{{ fmtMoney(out.gross.total_annual) }}</td></tr>
              <tr><td>Pre-tax deductions</td><td class="num">−{{ fmtMoney(out.pretax_total) }}</td></tr>
              <tr>
                <td>{{ out.used_itemized ? 'Itemized deduction' : 'Standard deduction' }}</td>
                <td class="num">−{{ fmtMoney(out.federal_deduction) }}</td>
              </tr>
              @if (out.tips_deduction > 0) {
                <tr><td>Tips deduction (OBBBA)</td><td class="num">−{{ fmtMoney(out.tips_deduction) }}</td></tr>
              }
              @if (out.overtime_deduction > 0) {
                <tr><td>Overtime premium deduction (OBBBA)</td><td class="num">−{{ fmtMoney(out.overtime_deduction) }}</td></tr>
              }
              <tr class="rule"><td>Federal taxable income</td><td class="num">{{ fmtMoney(out.federal_taxable_income) }}</td></tr>
              <tr><td>Federal income tax (ordinary)</td><td class="num">{{ fmtMoney(out.federal_ordinary_tax) }}</td></tr>
              @if (out.capital_gains_tax > 0) {
                <tr><td>Long-term capital gains tax</td><td class="num">{{ fmtMoney(out.capital_gains_tax) }}</td></tr>
              }
              @if (out.net_investment_income_tax > 0) {
                <tr><td>Net investment income tax (3.8%)</td><td class="num">{{ fmtMoney(out.net_investment_income_tax) }}</td></tr>
              }
              @if (out.child_tax_credit + out.other_dependent_credit > 0) {
                <tr><td>Dependent credits</td><td class="num">−{{ fmtMoney(out.child_tax_credit + out.other_dependent_credit) }}</td></tr>
              }
              <tr><td>Social Security (6.2%)</td><td class="num">{{ fmtMoney(out.fica.social_security) }}</td></tr>
              <tr><td>Medicare (1.45%{{ out.fica.additional_medicare > 0 ? ' + 0.9%' : '' }})</td>
                  <td class="num">{{ fmtMoney(out.fica.medicare + out.fica.additional_medicare) }}</td></tr>
              @if (out.self_employment_tax > 0) {
                <tr><td>Self-employment tax</td><td class="num">{{ fmtMoney(out.self_employment_tax) }}</td></tr>
              }
              <tr>
                <td>{{ out.state_tax.state_name }} state tax{{ out.state_tax.approximate ? ' (approx.)' : '' }}</td>
                <td class="num">{{ fmtMoney(out.state_tax.tax) }}</td>
              </tr>
              <tr class="rule strong"><td>Total tax</td><td class="num">{{ fmtMoney(out.total_tax) }}</td></tr>
              <tr class="strong"><td>Net income</td><td class="num">{{ fmtMoney(out.net_annual) }}</td></tr>
            </tbody>
          </table>
        </div>
        @if (out.state_tax.note) {
          <p class="fine">{{ out.state_tax.note }}</p>
        }
      </section>

      <section class="card">
        <header class="card-head">
          <h2>Paycheck detail</h2>
          <select class="freq-select" [ngModel]="paycheckFreq()" (ngModelChange)="paycheckFreq.set($event)">
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="semimonthly">Semi-monthly</option>
            <option value="monthly">Monthly</option>
          </select>
        </header>
        <div class="table-scroll">
          <table>
            <tbody>
              <tr><td>Gross pay</td><td class="num">{{ fmtMoneyExact(perCheck(out.gross.total_annual)) }}</td></tr>
              @for (line of nonzero(out.pretax_deductions); track line.label) {
                <tr><td>{{ line.label }}</td><td class="num">−{{ fmtMoneyExact(perCheck(line.annual)) }}</td></tr>
              }
              <tr><td>Federal income tax</td><td class="num">−{{ fmtMoneyExact(perCheck(out.federal_tax)) }}</td></tr>
              @if (out.self_employment_tax > 0) {
                <tr><td>Self-employment tax</td><td class="num">−{{ fmtMoneyExact(perCheck(out.self_employment_tax)) }}</td></tr>
              }
              <tr><td>Social Security</td><td class="num">−{{ fmtMoneyExact(perCheck(out.fica.social_security)) }}</td></tr>
              <tr><td>Medicare</td><td class="num">−{{ fmtMoneyExact(perCheck(out.fica.medicare + out.fica.additional_medicare)) }}</td></tr>
              @if (out.state_tax.tax > 0) {
                <tr><td>{{ out.state_tax.state_name }} tax</td><td class="num">−{{ fmtMoneyExact(perCheck(out.state_tax.tax)) }}</td></tr>
              }
              @for (line of nonzero(out.posttax_deductions); track line.label) {
                <tr><td>{{ line.label }}</td><td class="num">−{{ fmtMoneyExact(perCheck(line.annual)) }}</td></tr>
              }
              <tr class="rule strong"><td>Take-home per check</td><td class="num">{{ fmtMoneyExact(perCheck(out.net_annual)) }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Employer's true cost</h2>
        <div class="table-scroll">
          <table>
            <tbody>
              <tr><td>Wages</td><td class="num">{{ fmtMoney(out.gross.wage_annual) }}</td></tr>
              <tr><td>Employer Social Security + Medicare</td><td class="num">{{ fmtMoney(out.employer.social_security + out.employer.medicare) }}</td></tr>
              <tr><td>FUTA</td><td class="num">{{ fmtMoney(out.employer.futa) }}</td></tr>
              <tr><td>401(k) match</td><td class="num">{{ fmtMoney(out.employer.retirement_match) }}</td></tr>
              <tr class="rule strong"><td>Total cost of employment</td><td class="num">{{ fmtMoney(out.employer.total_cost) }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>50 / 30 / 20 budget (monthly net)</h2>
        <div class="budget-row">
          <div class="budget-cell">
            <span class="budget-num">{{ fmtMoney(out.budget.monthly_needs) }}</span>
            <span class="budget-cap">Needs · 50%</span>
          </div>
          <div class="budget-cell">
            <span class="budget-num">{{ fmtMoney(out.budget.monthly_wants) }}</span>
            <span class="budget-cap">Wants · 30%</span>
          </div>
          <div class="budget-cell">
            <span class="budget-num">{{ fmtMoney(out.budget.monthly_savings) }}</span>
            <span class="budget-cap">Savings · 20%</span>
          </div>
        </div>
      </section>
    } @else {
      <section class="card">
        <p>Loading the calculation engine…</p>
      </section>
    }
  `,
  styles: `
    .hero-card {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: flex-start;
    }
    .hero {
      display: grid;
      gap: 0.75rem;
    }
    .hero-label {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .hero-value {
      font-size: 2.4rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.1;
    }
    .hero-per {
      font-size: 1.1rem;
      font-weight: 400;
      color: var(--text-muted);
    }
    .hero-sub {
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    .hero-chips {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .chip {
      background: var(--chip-bg);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.2rem 0.7rem;
      font-size: 0.78rem;
      color: var(--text-secondary);
    }
    .actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .warnings ul {
      margin: 0;
      padding-left: 1.2rem;
      color: var(--text-secondary);
      font-size: 0.85rem;
      display: grid;
      gap: 0.25rem;
    }
    .budget-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.75rem;
    }
    .budget-cell {
      background: var(--chip-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.9rem;
      display: grid;
      gap: 0.2rem;
    }
    .budget-num {
      font-size: 1.3rem;
      font-weight: 650;
      color: var(--text-primary);
    }
    .budget-cap {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .fine {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin: 0.6rem 0 0;
    }
    .insights {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }
    .insights li {
      border: 1px solid var(--border);
      border-left: 3px solid var(--accent);
      border-radius: 8px;
      padding: 0.6rem 0.8rem;
      display: grid;
      gap: 0.2rem;
    }
    .insight-head {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: baseline;
    }
    .insight-value {
      color: var(--delta-good);
      font-weight: 650;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .insight-detail {
      font-size: 0.82rem;
      color: var(--text-secondary);
    }
    .solver-row {
      display: flex;
      gap: 1.25rem;
      align-items: flex-end;
      flex-wrap: wrap;
    }
    .solver-row label {
      max-width: 220px;
    }
    .solver-answer {
      display: grid;
      gap: 0.1rem;
      padding-bottom: 0.2rem;
    }
    .solver-num {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .solver-cap {
      font-size: 0.78rem;
      color: var(--text-muted);
    }
    .freq-select {
      width: auto;
    }
  `,
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
