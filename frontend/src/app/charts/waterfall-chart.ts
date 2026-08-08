import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CalculationOutput } from '../models';
import { money, moneyCompact } from '../format';

interface Step {
  label: string;
  /** Negative = money removed. */
  delta: number;
  /** Bar geometry (running totals). */
  from: number;
  to: number;
  colorVar: string;
  isAnchor: boolean; // gross / net full-height bars
}

const W = 720;
const H = 300;
const PAD = { top: 24, right: 12, bottom: 44, left: 56 };

@Component({
  selector: 'app-waterfall-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './waterfall-chart.html',
  styleUrl: './waterfall-chart.scss',
})
export class WaterfallChartComponent {
  readonly output = input.required<CalculationOutput>();

  readonly W = W;
  readonly H = H;
  readonly PAD = PAD;
  readonly hovered = signal<Step | null>(null);

  // Color follows the entity — same assignments as the donut.
  readonly steps = computed<Step[]>(() => {
    const out = this.output();
    const gross = out.gross.total_annual;
    let running = gross;
    const steps: Step[] = [
      { label: 'Gross', delta: gross, from: 0, to: gross, colorVar: '--series-7', isAnchor: true },
    ];
    const push = (label: string, amount: number, colorVar: string) => {
      if (amount <= 0.005) return;
      const from = running;
      running -= amount;
      steps.push({ label, delta: -amount, from, to: running, colorVar, isAnchor: false });
    };
    push('Pre-tax', out.pretax_total, '--series-5');
    push('Federal', out.federal_tax + out.self_employment_tax, '--series-2');
    push('FICA', out.fica.total, '--series-3');
    push('State', out.state_tax.tax, '--series-4');
    push('Post-tax', out.posttax_total, '--series-6');
    steps.push({
      label: 'Take-home',
      delta: running,
      from: 0,
      to: running,
      colorVar: '--series-1',
      isAnchor: true,
    });
    return steps;
  });

  readonly maxY = computed(() => Math.max(1, this.output().gross.total_annual) * 1.06);

  barWidth(): number {
    const n = this.steps().length;
    return ((W - PAD.left - PAD.right) / n) * 0.68;
  }

  x(i: number): number {
    const n = this.steps().length;
    const slot = (W - PAD.left - PAD.right) / n;
    return PAD.left + slot * i + (slot - this.barWidth()) / 2;
  }

  y(value: number): number {
    return H - PAD.bottom - (value / this.maxY()) * (H - PAD.top - PAD.bottom);
  }

  barHeight(step: Step): number {
    return Math.max(1.5, Math.abs(this.y(step.from) - this.y(step.to)));
  }

  readonly yTicks = computed(() => {
    const max = this.maxY();
    const step = niceStep(max / 4);
    const ticks = [];
    for (let v = 0; v <= max; v += step) {
      ticks.push({ value: v, y: this.y(v), label: moneyCompact(v) });
    }
    return ticks;
  });

  fmtMoney = money;
  fmtCompact = moneyCompact;
}

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
