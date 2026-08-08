import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { K401Point } from '../models';
import { money, moneyCompact } from '../format';

const W = 720;
const H = 300;
const PAD = { top: 14, right: 16, bottom: 30, left: 56 };

@Component({
  selector: 'app-k401-curve-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="legend" role="list">
        <span role="listitem"><i class="swatch s1"></i> Take-home</span>
        <span role="listitem"><i class="swatch s5"></i> Retirement dollars (you + match)</span>
        <span role="listitem"><i class="swatch s3"></i> Total wealth captured</span>
        <span role="listitem"><i class="swatch marker"></i> Current setting</span>
      </div>
      <svg
        [attr.viewBox]="'0 0 ' + W + ' ' + H"
        role="img"
        aria-label="Take-home, retirement dollars, and total wealth by 401(k) contribution percentage"
        (mousemove)="onMove($event)"
        (mouseleave)="hover.set(null)"
      >
        @for (tick of yTicks(); track tick.value) {
          <line [attr.x1]="PAD.left" [attr.y1]="tick.y" [attr.x2]="W - PAD.right" [attr.y2]="tick.y" class="grid" />
          <text [attr.x]="PAD.left - 8" [attr.y]="tick.y + 4" class="axis" text-anchor="end">{{ tick.label }}</text>
        }
        @for (tick of xTicks(); track tick.value) {
          <text [attr.x]="tick.x" [attr.y]="H - 8" class="axis" text-anchor="middle">{{ tick.value }}%</text>
        }
        <line [attr.x1]="PAD.left" [attr.y1]="H - PAD.bottom" [attr.x2]="W - PAD.right" [attr.y2]="H - PAD.bottom" class="baseline" />
        <path [attr.d]="pathOf('net')" class="line s1" />
        <path [attr.d]="pathOf('ret')" class="line s5" />
        <path [attr.d]="pathOf('total')" class="line s3" />
        @if (currentPercent() > 0) {
          <line [attr.x1]="x(currentPercent())" [attr.y1]="PAD.top" [attr.x2]="x(currentPercent())" [attr.y2]="H - PAD.bottom" class="marker-line" />
        }
        @if (hover(); as h) {
          <line [attr.x1]="x(h.percent)" [attr.y1]="PAD.top" [attr.x2]="x(h.percent)" [attr.y2]="H - PAD.bottom" class="crosshair" />
          <circle [attr.cx]="x(h.percent)" [attr.cy]="y(h.net_annual)" r="4" class="dot s1" />
          <circle [attr.cx]="x(h.percent)" [attr.cy]="y(h.retirement_total)" r="4" class="dot s5" />
          <circle [attr.cx]="x(h.percent)" [attr.cy]="y(h.total_wealth)" r="4" class="dot s3" />
        }
      </svg>
      @if (hover(); as h) {
        <div class="tooltip">
          <strong>{{ h.percent.toFixed(0) }}% contribution</strong>
          <span><i class="swatch s1"></i>{{ fmtMoney(h.net_annual) }}</span>
          <span><i class="swatch s5"></i>{{ fmtMoney(h.retirement_total) }}</span>
          <span><i class="swatch s3"></i>{{ fmtMoney(h.total_wealth) }}</span>
          @if (h.employer_match > 0) {
            <span class="muted">incl. {{ fmtMoney(h.employer_match) }} match</span>
          }
        </div>
      } @else {
        <div class="tooltip hint">
          The aqua line rising means contributing captures more total wealth — the tax savings and
          match outweigh the take-home hit.
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
    .swatch.s5, .dot.s5 { background: var(--series-5); }
    .swatch.s3, .dot.s3 { background: var(--series-3); }
    .swatch.marker { background: var(--series-6); }
    .grid { stroke: var(--gridline); stroke-width: 1; }
    .baseline { stroke: var(--baseline); stroke-width: 1; }
    .axis { font-size: 11px; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
    .line { fill: none; stroke-width: 2; }
    .line.s1 { stroke: var(--series-1); }
    .line.s5 { stroke: var(--series-5); }
    .line.s3 { stroke: var(--series-3); }
    .dot { stroke: var(--surface-1); stroke-width: 2; }
    .dot.s1 { fill: var(--series-1); }
    .dot.s5 { fill: var(--series-5); }
    .dot.s3 { fill: var(--series-3); }
    .marker-line { stroke: var(--series-6); stroke-width: 1.5; stroke-dasharray: 5 4; }
    .crosshair { stroke: var(--baseline); stroke-width: 1; stroke-dasharray: 3 3; }
    .tooltip {
      display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; align-items: center;
      color: var(--text-primary); min-height: 1.2rem; font-variant-numeric: tabular-nums;
    }
    .tooltip .muted { color: var(--text-muted); }
    .tooltip.hint { color: var(--text-muted); }
  `,
})
export class K401CurveChartComponent {
  readonly curve = input.required<K401Point[]>();
  readonly currentPercent = input(0);

  readonly W = W;
  readonly H = H;
  readonly PAD = PAD;
  readonly hover = signal<K401Point | null>(null);

  readonly maxPercent = computed(() => Math.max(1, ...this.curve().map((p) => p.percent)));
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
