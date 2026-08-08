import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RothTradYear } from '../models';
import { money, moneyCompact } from '../format';

const W = 720;
const H = 280;
const PAD = { top: 14, right: 16, bottom: 28, left: 56 };

@Component({
  selector: 'app-roth-trad-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="legend" role="list">
        <span role="listitem"><i class="swatch s1"></i> Traditional (after retirement tax)</span>
        <span role="listitem"><i class="swatch s2"></i> Roth (tax-free withdrawals)</span>
      </div>
      <svg
        [attr.viewBox]="'0 0 ' + W + ' ' + H"
        role="img"
        aria-label="After-tax value of traditional versus Roth over time"
        (mousemove)="onMove($event)"
        (mouseleave)="hover.set(null)"
      >
        @for (tick of yTicks(); track tick.value) {
          <line [attr.x1]="PAD.left" [attr.y1]="tick.y" [attr.x2]="W - PAD.right" [attr.y2]="tick.y" class="grid" />
          <text [attr.x]="PAD.left - 8" [attr.y]="tick.y + 4" class="axis" text-anchor="end">{{ tick.label }}</text>
        }
        @for (tick of xTicks(); track tick.value) {
          <text [attr.x]="tick.x" [attr.y]="H - 6" class="axis" text-anchor="middle">{{ tick.value }}</text>
        }
        <line [attr.x1]="PAD.left" [attr.y1]="H - PAD.bottom" [attr.x2]="W - PAD.right" [attr.y2]="H - PAD.bottom" class="baseline" />
        <path [attr.d]="pathTrad()" class="line s1" />
        <path [attr.d]="pathRoth()" class="line s2" />
        @if (hover(); as h) {
          <line [attr.x1]="x(h.year)" [attr.y1]="PAD.top" [attr.x2]="x(h.year)" [attr.y2]="H - PAD.bottom" class="crosshair" />
          <circle [attr.cx]="x(h.year)" [attr.cy]="y(h.traditional_after_tax)" r="4" class="dot s1" />
          <circle [attr.cx]="x(h.year)" [attr.cy]="y(h.roth_after_tax)" r="4" class="dot s2" />
        }
      </svg>
      @if (hover(); as h) {
        <div class="tooltip">
          <strong>Year {{ h.year }}</strong>
          <span><i class="swatch s1"></i>{{ fmtMoney(h.traditional_after_tax) }}</span>
          <span><i class="swatch s2"></i>{{ fmtMoney(h.roth_after_tax) }}</span>
          <span class="muted">Δ {{ fmtMoney(h.traditional_after_tax - h.roth_after_tax) }}</span>
        </div>
      } @else {
        <div class="tooltip hint">
          Equal out-of-pocket comparison: the Roth contribution is reduced by today's tax.
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
    .swatch.s2, .dot.s2 { background: var(--series-2); }
    .grid { stroke: var(--gridline); stroke-width: 1; }
    .baseline { stroke: var(--baseline); stroke-width: 1; }
    .axis { font-size: 11px; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
    .line { fill: none; stroke-width: 2; }
    .line.s1 { stroke: var(--series-1); }
    .line.s2 { stroke: var(--series-2); }
    .dot { stroke: var(--surface-1); stroke-width: 2; }
    .dot.s1 { fill: var(--series-1); }
    .dot.s2 { fill: var(--series-2); }
    .crosshair { stroke: var(--baseline); stroke-width: 1; stroke-dasharray: 3 3; }
    .tooltip {
      display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; align-items: center;
      color: var(--text-primary); min-height: 1.2rem; font-variant-numeric: tabular-nums;
    }
    .tooltip .muted { color: var(--text-muted); }
    .tooltip.hint { color: var(--text-muted); }
  `,
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
