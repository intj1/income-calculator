import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RothTradYear } from '../models';
import { money, moneyCompact } from '../format';

const W = 720;
const H = 280;
const PAD = { top: 14, right: 16, bottom: 28, left: 56 };

@Component({
  selector: 'app-roth-trad-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roth-trad-chart.html',
  styleUrl: './roth-trad-chart.scss',
})
export class RothTradChartComponent {
  readonly years = input.required<RothTradYear[]>();

  readonly W = W;
  readonly H = H;
  readonly PAD = PAD;
  readonly hover = signal<RothTradYear | null>(null);

  readonly maxYear = computed(() => Math.max(1, ...this.years().map((y) => y.year)));
  readonly maxY = computed(
    () =>
      Math.max(1, ...this.years().map((y) => Math.max(y.traditional_after_tax, y.roth_after_tax))) *
      1.04,
  );

  x(year: number): number {
    return PAD.left + ((year - 1) / Math.max(1, this.maxYear() - 1)) * (W - PAD.left - PAD.right);
  }

  y(value: number): number {
    return H - PAD.bottom - (value / this.maxY()) * (H - PAD.top - PAD.bottom);
  }

  readonly pathTrad = computed(() => this.path((y) => y.traditional_after_tax));
  readonly pathRoth = computed(() => this.path((y) => y.roth_after_tax));

  private path(pick: (y: RothTradYear) => number): string {
    const ys = this.years();
    if (!ys.length) return '';
    return ys
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${this.x(p.year).toFixed(1)} ${this.y(pick(p)).toFixed(1)}`)
      .join(' ');
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

  readonly xTicks = computed(() => {
    const ys = this.years();
    if (!ys.length) return [];
    const every = Math.max(1, Math.ceil(ys.length / 8));
    return ys
      .filter((y) => y.year % every === 0 || y.year === ys.length)
      .map((y) => ({ value: y.year, x: this.x(y.year) }));
  });

  onMove(ev: MouseEvent): void {
    const ys = this.years();
    if (!ys.length) return;
    const svg = ev.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    const frac = (px - PAD.left) / (W - PAD.left - PAD.right);
    const idx = Math.round(frac * Math.max(1, ys.length - 1));
    this.hover.set(ys[Math.max(0, Math.min(ys.length - 1, idx))]);
  }

  fmtMoney = money;
}

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
