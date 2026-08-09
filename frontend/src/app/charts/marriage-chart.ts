import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MarriagePoint } from '../models';
import { money, moneyCompact } from '../format';

const W = 720;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 30, left: 62 };

@Component({
  selector: 'app-marriage-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marriage-chart.html',
  styleUrl: './marriage-chart.scss',
})
export class MarriageChartComponent {
  readonly sweep = input.required<MarriagePoint[]>();

  readonly W = W;
  readonly H = H;
  readonly PAD = PAD;
  readonly hover = signal<MarriagePoint | null>(null);

  readonly maxIncome = computed(() => Math.max(1, ...this.sweep().map((p) => p.partner_income)));

  /** Symmetric-ish y-domain covering both bonus and penalty extremes. */
  readonly yExtent = computed(() => {
    const values = this.sweep().map((p) => p.bonus);
    const max = Math.max(500, ...values) * 1.15;
    const min = Math.min(-500, ...values) * 1.15;
    return { min, max };
  });

  x(income: number): number {
    return PAD.left + (income / this.maxIncome()) * (W - PAD.left - PAD.right);
  }

  y(value: number): number {
    const { min, max } = this.yExtent();
    return PAD.top + ((max - value) / (max - min)) * (H - PAD.top - PAD.bottom);
  }

  readonly zeroY = computed(() => this.y(0));

  readonly linePath = computed(() => {
    const sweep = this.sweep();
    if (!sweep.length) return '';
    return sweep
      .map(
        (p, i) =>
          `${i === 0 ? 'M' : 'L'} ${this.x(p.partner_income).toFixed(1)} ${this.y(p.bonus).toFixed(1)}`,
      )
      .join(' ');
  });

  /** Area between the curve and the zero line; clipped into bonus/penalty halves. */
  readonly areaPath = computed(() => {
    const sweep = this.sweep();
    if (!sweep.length) return '';
    const zero = this.zeroY();
    const forward = sweep.map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${this.x(p.partner_income).toFixed(1)} ${this.y(p.bonus).toFixed(1)}`,
    );
    const last = sweep[sweep.length - 1];
    return (
      forward.join(' ') +
      ` L ${this.x(last.partner_income).toFixed(1)} ${zero.toFixed(1)}` +
      ` L ${this.x(sweep[0].partner_income).toFixed(1)} ${zero.toFixed(1)} Z`
    );
  });

  readonly yTicks = computed(() => {
    const { min, max } = this.yExtent();
    const step = niceStep((max - min) / 5);
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
      ticks.push({ value: v, y: this.y(v), label: moneyCompact(v) });
    }
    return ticks;
  });

  readonly xTicks = computed(() => {
    const max = this.maxIncome();
    const step = niceStep(max / 5);
    const ticks = [];
    for (let v = 0; v <= max; v += step) {
      ticks.push({ value: v, x: this.x(v), label: moneyCompact(v) });
    }
    return ticks;
  });

  onMove(ev: MouseEvent): void {
    const sweep = this.sweep();
    if (!sweep.length) return;
    const svg = ev.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    const income = ((px - PAD.left) / (W - PAD.left - PAD.right)) * this.maxIncome();
    const point = sweep.reduce((best, p) =>
      Math.abs(p.partner_income - income) < Math.abs(best.partner_income - income) ? p : best,
    );
    this.hover.set(point);
  }

  fmtMoney = money;
}

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
