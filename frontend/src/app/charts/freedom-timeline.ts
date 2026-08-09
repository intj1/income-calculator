import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CalculationOutput } from '../models';
import { money } from '../format';

interface Segment {
  label: string;
  days: number;
  x: number;
  width: number;
  colorVar: string;
  amount: number;
}

const W = 760;
const H = 96;
const PAD = { left: 8, right: 8, top: 30, bottom: 26 };
const BAR_H = 26;
const YEAR_DAYS = 365;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

@Component({
  selector: 'app-freedom-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './freedom-timeline.html',
  styleUrl: './freedom-timeline.scss',
})
export class FreedomTimelineComponent {
  readonly output = input.required<CalculationOutput>();

  readonly W = W;
  readonly H = H;
  readonly PAD = PAD;
  readonly BAR_H = BAR_H;
  readonly hovered = signal<Segment | null>(null);

  private dayX(day: number): number {
    return PAD.left + (day / YEAR_DAYS) * (W - PAD.left - PAD.right);
  }

  readonly segments = computed<Segment[]>(() => {
    const out = this.output();
    const gross = out.gross.total_annual;
    if (gross <= 0) return [];
    const daysFor = (amount: number) => (amount / gross) * YEAR_DAYS;
    const parts = [
      {
        label: 'Federal',
        amount: out.federal_tax + out.self_employment_tax,
        colorVar: '--series-2',
      },
      { label: 'FICA', amount: out.fica.total, colorVar: '--series-3' },
      { label: out.state_tax.state_name + ' tax', amount: out.state_tax.tax, colorVar: '--series-4' },
    ].filter((p) => p.amount > 0.005);

    const segments: Segment[] = [];
    let day = 0;
    for (const part of parts) {
      const days = daysFor(part.amount);
      segments.push({
        label: part.label,
        days,
        amount: part.amount,
        x: this.dayX(day),
        width: this.dayX(day + days) - this.dayX(day),
        colorVar: part.colorVar,
      });
      day += days;
    }
    // The rest of the year is yours (net + deductions you keep as savings).
    segments.push({
      label: 'Your money',
      days: YEAR_DAYS - day,
      amount: gross - out.total_tax,
      x: this.dayX(day),
      width: this.dayX(YEAR_DAYS) - this.dayX(day),
      colorVar: '--series-1',
    });
    return segments;
  });

  /** Day of year when cumulative taxes are paid off. */
  readonly freedomDay = computed(() => {
    const out = this.output();
    const gross = out.gross.total_annual;
    if (gross <= 0) return 0;
    return Math.min(YEAR_DAYS - 1, Math.round((out.total_tax / gross) * YEAR_DAYS));
  });

  readonly freedomX = computed(() => this.dayX(this.freedomDay()));

  readonly freedomDate = computed(() => {
    let remaining = this.freedomDay();
    for (let m = 0; m < 12; m++) {
      if (remaining < MONTH_DAYS[m]) return `${MONTHS[m]} ${remaining + 1}`;
      remaining -= MONTH_DAYS[m];
    }
    return 'Dec 31';
  });

  readonly monthTicks = computed(() => {
    const ticks = [];
    let day = 0;
    for (let m = 0; m < 12; m++) {
      ticks.push({ label: MONTHS[m], x: this.dayX(day + MONTH_DAYS[m] / 2), lineX: this.dayX(day) });
      day += MONTH_DAYS[m];
    }
    return ticks;
  });

  fmtMoney = money;
}
