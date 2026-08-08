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
  template: `
    <div class="wrap">
      <div class="legend" role="list">
        <span role="listitem"><i class="swatch s1"></i> Net income</span>
        <span role="listitem"><i class="swatch guide"></i> Gross (no-tax reference)</span>
        <span role="listitem"><i class="swatch marker"></i> You are here</span>
      </div>
      <svg
        [attr.viewBox]="'0 0 ' + W + ' ' + H_NET"
        role="img"
        aria-label="Net income as gross income grows"
        (mousemove)="onMove($event, 'net')"
        (mouseleave)="hover.set(null)"
      >
        @for (tick of netTicks(); track tick.value) {
          <line [attr.x1]="PAD.left" [attr.y1]="tick.y" [attr.x2]="W - PAD.right" [attr.y2]="tick.y" class="grid" />
          <text [attr.x]="PAD.left - 8" [attr.y]="tick.y + 4" class="axis" text-anchor="end">{{ tick.label }}</text>
        }
        <line [attr.x1]="PAD.left" [attr.y1]="yNetBase()" [attr.x2]="W - PAD.right" [attr.y2]="yNetBase()" class="baseline" />
        <path [attr.d]="grossGuidePath()" class="guide-line" />
        <path [attr.d]="netPath()" class="line s1" />
        @if (currentPoint(); as cp) {
          <line [attr.x1]="xAmount(cp.gross_annual)" [attr.y1]="PAD.top" [attr.x2]="xAmount(cp.gross_annual)" [attr.y2]="yNetBase()" class="marker-line" />
          <circle [attr.cx]="xAmount(cp.gross_annual)" [attr.cy]="yNet(cp.net_annual)" r="5" class="marker-dot" />
        }
        @if (hover(); as h) {
          <line [attr.x1]="xAmount(h.gross_annual)" [attr.y1]="PAD.top" [attr.x2]="xAmount(h.gross_annual)" [attr.y2]="yNetBase()" class="crosshair" />
          <circle [attr.cx]="xAmount(h.gross_annual)" [attr.cy]="yNet(h.net_annual)" r="4" class="dot s1" />
        }
      </svg>

      <div class="legend" role="list">
        <span role="listitem"><i class="swatch s1"></i> Effective tax rate</span>
        <span role="listitem"><i class="swatch s2"></i> Marginal rate (fed + state)</span>
      </div>
      <svg
        [attr.viewBox]="'0 0 ' + W + ' ' + H_RATE"
        role="img"
        aria-label="Effective and marginal tax rates as income grows"
        (mousemove)="onMove($event, 'rate')"
        (mouseleave)="hover.set(null)"
      >
        @for (tick of rateTicks(); track tick.value) {
          <line [attr.x1]="PAD.left" [attr.y1]="tick.y" [attr.x2]="W - PAD.right" [attr.y2]="tick.y" class="grid" />
          <text [attr.x]="PAD.left - 8" [attr.y]="tick.y + 4" class="axis" text-anchor="end">{{ tick.value }}%</text>
        }
        <line [attr.x1]="PAD.left" [attr.y1]="yRateBase()" [attr.x2]="W - PAD.right" [attr.y2]="yRateBase()" class="baseline" />
        <path [attr.d]="effectivePath()" class="line s1" />
        <path [attr.d]="marginalPath()" class="line s2 stepped" />
        @for (tick of xTicks(); track tick.value) {
          <text [attr.x]="tick.x" [attr.y]="H_RATE - 6" class="axis" text-anchor="middle">{{ tick.label }}</text>
        }
        @if (currentPoint(); as cp) {
          <line [attr.x1]="xAmount(cp.gross_annual)" [attr.y1]="PAD.top" [attr.x2]="xAmount(cp.gross_annual)" [attr.y2]="yRateBase()" class="marker-line" />
        }
        @if (hover(); as h) {
          <line [attr.x1]="xAmount(h.gross_annual)" [attr.y1]="PAD.top" [attr.x2]="xAmount(h.gross_annual)" [attr.y2]="yRateBase()" class="crosshair" />
        }
      </svg>

      @if (hover(); as h) {
        <div class="tooltip">
          <strong>{{ fmtMoney(h.gross_annual) }} gross</strong>
          <span><i class="swatch s1"></i>Net {{ fmtMoney(h.net_annual) }}</span>
          <span class="muted">Tax {{ fmtMoney(h.total_tax) }}</span>
          <span class="muted">Effective {{ fmtPct(h.effective_rate) }} · Marginal {{ fmtPct(h.marginal_rate) }}</span>
        </div>
      } @else if (currentPoint(); as cp) {
        <div class="tooltip">
          <strong>Currently {{ fmtMoney(cp.gross_annual) }} gross</strong>
          <span class="muted">Hover to explore other income levels. Flat steps in the marginal line are tax brackets.</span>
        </div>
      }
    </div>
  `,
  styles: `
    .wrap { display: grid; gap: 0.4rem; }
    svg { width: 100%; }
    .legend { display: flex; gap: 1.25rem; font-size: 0.8rem; color: var(--text-secondary); flex-wrap: wrap; }
    .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 0.4rem; }
    .swatch.s1, .dot.s1 { background: var(--series-1); }
    .swatch.s2 { background: var(--series-2); }
    .swatch.guide { background: var(--baseline); }
    .swatch.marker { background: var(--series-6); }
    .grid { stroke: var(--gridline); stroke-width: 1; }
    .baseline { stroke: var(--baseline); stroke-width: 1; }
    .axis { font-size: 11px; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
    .line { fill: none; stroke-width: 2; }
    .line.s1 { stroke: var(--series-1); }
    .line.s2 { stroke: var(--series-2); }
    .guide-line { fill: none; stroke: var(--baseline); stroke-width: 1.5; stroke-dasharray: 4 4; }
    .marker-line { stroke: var(--series-6); stroke-width: 1.5; stroke-dasharray: 5 4; }
    .marker-dot { fill: var(--series-6); stroke: var(--surface-1); stroke-width: 2; }
    .dot.s1 { fill: var(--series-1); stroke: var(--surface-1); stroke-width: 2; }
    .crosshair { stroke: var(--baseline); stroke-width: 1; stroke-dasharray: 3 3; }
    .tooltip {
      display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; align-items: center;
      color: var(--text-primary); min-height: 1.2rem; font-variant-numeric: tabular-nums;
    }
    .tooltip .muted { color: var(--text-muted); }
  `,
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
