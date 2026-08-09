import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { K401Point } from '../models';
import { money, moneyCompact } from '../format';

const W = 720;
const H = 300;
const PAD = { top: 14, right: 16, bottom: 30, left: 56 };

@Component({
  selector: 'app-k401-curve-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './k401-curve-chart.html',
  styleUrl: './k401-curve-chart.scss',
})
export class K401CurveChartComponent {
  readonly curve = input.required<K401Point[]>();
  readonly currentPercent = input(0);

  readonly W = W;
  readonly H = H;
  readonly PAD = PAD;
  readonly hover = signal<K401Point | null>(null);

  readonly maxPercent = computed(() => Math.max(1, ...this.curve().map((p) => p.percent)));

  /** Marker position, clamped so an out-of-range setting doesn't draw outside the plot. */
  readonly markerPercent = computed(() =>
    Math.min(Math.max(0, this.currentPercent()), this.maxPercent()),
  );
  readonly maxY = computed(
    () => Math.max(1, ...this.curve().map((p) => p.total_wealth)) * 1.04,
  );

  x(percent: number): number {
    return PAD.left + (percent / this.maxPercent()) * (W - PAD.left - PAD.right);
  }

  y(value: number): number {
    return H - PAD.bottom - (value / this.maxY()) * (H - PAD.top - PAD.bottom);
  }

  pathOf(series: 'net' | 'ret' | 'total'): string {
    const pick = (p: K401Point) =>
      series === 'net' ? p.net_annual : series === 'ret' ? p.retirement_total : p.total_wealth;
    const curve = this.curve();
    if (!curve.length) return '';
    return curve
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${this.x(p.percent).toFixed(1)} ${this.y(pick(p)).toFixed(1)}`)
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
    const max = this.maxPercent();
    const step = max > 25 ? 10 : 5;
    const ticks = [];
    for (let v = 0; v <= max; v += step) {
      ticks.push({ value: v, x: this.x(v) });
    }
    return ticks;
  });

  onMove(ev: MouseEvent): void {
    const curve = this.curve();
    if (!curve.length) return;
    const svg = ev.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    const percent = ((px - PAD.left) / (W - PAD.left - PAD.right)) * this.maxPercent();
    const point = curve.reduce((best, p) =>
      Math.abs(p.percent - percent) < Math.abs(best.percent - percent) ? p : best,
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
