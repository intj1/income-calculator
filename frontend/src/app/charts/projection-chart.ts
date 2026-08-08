import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ProjectionYear } from '../models';
import { money, moneyCompact } from '../format';

const W = 720;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

interface HoverInfo {
  year: ProjectionYear;
  x: number;
  yNominal: number;
  yReal: number;
}

@Component({
  selector: 'app-projection-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projection-chart.html',
  styleUrl: './projection-chart.scss',
})
export class ProjectionChartComponent {
  readonly years = input.required<ProjectionYear[]>();
  readonly target = input(0);

  readonly W = W;
  readonly H = H;
  readonly PAD = PAD;
  readonly hover = signal<HoverInfo | null>(null);

  readonly hasBand = computed(() => this.years().some((y) => y.p90 > 0));

  readonly maxY = computed(() => {
    const ys = this.years();
    const peak = Math.max(1, ...ys.map((y) => Math.max(y.balance, y.p90)));
    // Keep the target line on-screen when it's within reach of the scale.
    const t = this.target();
    return Math.max(peak, t > 0 && t < peak * 3 ? t : 0) * 1.05;
  });

  readonly targetY = computed<number | null>(() => {
    const t = this.target();
    if (t <= 0 || t > this.maxY()) return null;
    return this.y(t);
  });

  readonly bandPath = computed(() => {
    const ys = this.years();
    if (!ys.length || !this.hasBand()) return '';
    const upper = ys.map(
      (y, i) => `${i === 0 ? 'M' : 'L'} ${this.x(y.year).toFixed(1)} ${this.y(y.p90).toFixed(1)}`,
    );
    const lower = [...ys]
      .reverse()
      .map((y) => `L ${this.x(y.year).toFixed(1)} ${this.y(y.p10).toFixed(1)}`);
    return upper.join(' ') + ' ' + lower.join(' ') + ' Z';
  });

  private x(year: number): number {
    const n = Math.max(1, this.years().length);
    return PAD.left + ((year - 1) / Math.max(1, n - 1)) * (W - PAD.left - PAD.right);
  }

  private y(value: number): number {
    return H - PAD.bottom - (value / this.maxY()) * (H - PAD.top - PAD.bottom);
  }

  readonly pathNominal = computed(() => this.linePath((y) => y.balance));
  readonly pathReal = computed(() => this.linePath((y) => y.real_balance));

  readonly yTicks = computed(() => {
    const max = this.maxY();
    const step = niceStep(max / 4);
    const ticks = [];
    for (let v = 0; v <= max; v += step) {
      ticks.push({ value: v, y: this.y(v), label: moneyCompact(v) });
    }
    return ticks;
  });

  readonly xTicks = computed(() => {
    const ys = this.years();
    if (!ys.length) return [];
    const every = Math.max(1, Math.ceil(ys.length / 8));
    return ys
      .filter((y) => y.year % every === 0 || y.year === ys.length)
      .map((y) => ({ value: y.year, x: this.x(y.year) }));
  });

  private linePath(pick: (y: ProjectionYear) => number): string {
    const ys = this.years();
    if (!ys.length) return '';
    return ys
      .map((y, i) => `${i === 0 ? 'M' : 'L'} ${this.x(y.year).toFixed(1)} ${this.y(pick(y)).toFixed(1)}`)
      .join(' ');
  }

  onMove(ev: MouseEvent): void {
    const ys = this.years();
    if (!ys.length) return;
    const svg = ev.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    const n = ys.length;
    const frac = (px - PAD.left) / (W - PAD.left - PAD.right);
    const idx = Math.round(frac * Math.max(1, n - 1));
    const year = ys[Math.max(0, Math.min(n - 1, idx))];
    this.hover.set({
      year,
      x: this.x(year.year),
      yNominal: this.y(year.balance),
      yReal: this.y(year.real_balance),
    });
  }

  fmtMoney = money;
}

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
