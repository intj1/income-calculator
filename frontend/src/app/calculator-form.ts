import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StoreService } from './store.service';
import {
  CalculationInput,
  IncomeKind,
  IncomeSource,
  PayFrequency,
  defaultIncomeSource,
} from './models';

const FREQUENCIES: Array<{ value: PayFrequency; label: string }> = [
  { value: 'hourly', label: 'Per hour' },
  { value: 'daily', label: 'Per day' },
  { value: 'weekly', label: 'Per week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'semimonthly', label: 'Twice a month' },
  { value: 'monthly', label: 'Per month' },
  { value: 'quarterly', label: 'Per quarter' },
  { value: 'annually', label: 'Per year' },
];

const KINDS: Array<{ value: IncomeKind; label: string }> = [
  { value: 'salary', label: 'Salary (W-2)' },
  { value: 'hourly', label: 'Hourly wage (W-2)' },
  { value: 'self_employment', label: 'Self-employment / 1099' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'commission', label: 'Commission' },
  { value: 'tips', label: 'Tips' },
  { value: 'rental', label: 'Rental income' },
  { value: 'interest', label: 'Interest / ordinary dividends' },
  { value: 'other', label: 'Other earned income' },
];

@Component({
  selector: 'app-calculator-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './calculator-form.html',
})
export class CalculatorFormComponent {
  /** 'A' edits the main scenario; 'B' edits the comparison scenario. */
  readonly scenario = input<'A' | 'B'>('A');

  readonly frequencies = FREQUENCIES;
  readonly kinds = KINDS;

  readonly inp = computed<CalculationInput>(() =>
    this.scenario() === 'A' ? this.store.input() : (this.store.scenarioB() ?? this.store.input()),
  );

  constructor(readonly store: StoreService) {}

  private apply(fn: (d: CalculationInput) => void): void {
    if (this.scenario() === 'A') this.store.patch(fn);
    else this.store.patchB(fn);
  }

  set(field: keyof CalculationInput, value: unknown): void {
    this.apply((d) => {
      (d as unknown as Record<string, unknown>)[field] = value;
    });
  }

  setNum(field: keyof CalculationInput, value: unknown, integer = false): void {
    this.set(field, toNum(value, integer));
  }

  setCg(field: string, value: unknown): void {
    this.apply((d) => {
      (d.capital_gains as unknown as Record<string, number>)[field] = toNum(value);
    });
  }

  setPre(field: string, value: unknown): void {
    this.apply((d) => {
      (d.pretax as unknown as Record<string, number>)[field] = toNum(value);
    });
  }

  setPost(field: string, value: unknown): void {
    this.apply((d) => {
      (d.posttax as unknown as Record<string, number>)[field] = toNum(value);
    });
  }

  setIncome(i: number, field: keyof IncomeSource, value: unknown): void {
    this.apply((d) => {
      (d.incomes[i] as unknown as Record<string, unknown>)[field] = value;
    });
  }

  setIncomeNum(i: number, field: keyof IncomeSource, value: unknown): void {
    this.setIncome(i, field, toNum(value));
  }

  addIncome(): void {
    this.apply((d) => {
      const src = defaultIncomeSource();
      src.label = 'Income ' + (d.incomes.length + 1);
      src.amount = 0;
      d.incomes.push(src);
    });
  }

  removeIncome(i: number): void {
    this.apply((d) => {
      d.incomes.splice(i, 1);
    });
  }
}

function toNum(v: unknown, integer = false): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!isFinite(n) || n < 0) return 0;
  return integer ? Math.floor(n) : n;
}
