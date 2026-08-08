import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CurvePoint } from '../models';
import { money, moneyCompact, pct } from '../format';

const W = 720;
const H_NET = 260;
const H_RATE = 170;
const PAD = { top: 14, right: 16, bottom: 26, left: 56 };

@Component({
  selector: 'app-income-curve-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './income-curve-chart.html',
  styleUrl: './income-curve-chart.scss',
})
export class IncomeCurveChartComponent {
  readonly curve = input.required<CurvePoint[]>();
  /** First income source's current amount ("you are here"). */
  readonly currentAmount = input(0);

  readonly W = W;
  readonly H_NET = H_NET;
  readonly H_RATE = H_RATE;
  readonly PAD = PAD;
  readonly hover = signal<CurvePoint | null>(null);

  // X axis is gross annual dollars (works for salary and hourly sweeps alike).
  readonly maxAmount = computed(() => Math.max(1, ...this.curve().map((p) => p.gross_annual)));
  readonly maxNet = computed(
    () => Math.max(1, ...this.curve().map((p) => Math.max(p.net_annual, p.gross_annual))) * 1.04,
  );
  readonly maxRate = computed(
    () => Math.min(1, Math.max(0.1, ...this.curve().map((p) => p.marginal_rate)) * 1.25),
  );

  readonly currentPoint = computed<CurvePoint | null>(() => {
    const amount = this.currentAmount();
    const curve = this.curve();
    if (!curve.length || amount <= 0) return null;
    const maxSwept = Math.max(...curve.map((p) => p.amount));
    if (amount > maxSwept) return null;
    return curve.reduce((best, p) =>
      Math.abs(p.amount - amount) < Math.abs(best.amount - amount) ? p : best,
    );
  });

  xAmount(amount: number): number {
    return PAD.left + (amount / this.maxAmount()) * (W - PAD.left - PAD.right);
  }

  yNet(value: number): number {
    return H_NET - PAD.bottom - (value / this.maxNet()) * (H_NET - PAD.top - PAD.bottom);
  }

  yNetBase(): number {
    return H_NET - PAD.bottom;
  }

  yRate(rate: number): number {
    return H_RATE - PAD.bottom - (rate / this.maxRate()) * (H_RATE - PAD.top - PAD.bottom);
  }

  yRateBase(): number {
    return H_RATE - PAD.bottom;
  }

  readonly netPath = computed(() => this.path((p) => this.yNet(p.net_annual)));
  readonly grossGuidePath = computed(() => this.path((p) => this.yNet(p.gross_annual)));
  readonly effectivePath = computed(() => this.path((p) => this.yRate(p.effective_rate)));
  readonly marginalPath = computed(() => this.path((p) => this.yRate(p.marginal_rate)));

  private path(yOf: (p: CurvePoint) => number): string {
    const curve = this.curve();
    if (!curve.length) return '';
    return curve
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${this.xAmount(p.gross_annual).toFixed(1)} ${yOf(p).toFixed(1)}`)
      .join(' ');
  }

  readonly netTicks = computed(() => {
    const max = this.maxNet();
    const step = niceStep(max / 4);
    const ticks = [];
    for (let v = 0; v <= max; v += step) {
      ticks.push({ value: v, y: this.yNet(v), label: moneyCompact(v) });
    }
    return ticks;
  });

  readonly rateTicks = computed(() => {
    const maxPct = this.maxRate() * 100;
    const step = maxPct > 30 ? 10 : 5;
    const ticks = [];
    for (let v = 0; v <= maxPct; v += step) {
      ticks.push({ value: v, y: this.yRate(v / 100) });
    }
    return ticks;
  });

  readonly xTicks = computed(() => {
    const max = this.maxAmount();
    const step = niceStep(max / 5);
    const ticks = [];
    for (let v = 0; v <= max; v += step) {
      ticks.push({ value: v, x: this.xAmount(v), label: moneyCompact(v) });
    }
    return ticks;
  });

  onMove(ev: MouseEvent, _panel: 'net' | 'rate'): void {
    const curve = this.curve();
    if (!curve.length) return;
    const svg = ev.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    const gross = ((px - PAD.left) / (W - PAD.left - PAD.right)) * this.maxAmount();
    const point = curve.reduce((best, p) =>
      Math.abs(p.gross_annual - gross) < Math.abs(best.gross_annual - gross) ? p : best,
    );
    this.hover.set(point);
  }

  fmtMoney = money;
  fmtPct = (v: number) => pct(v, 1);
}

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
