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
  template: `
    <div class="wrap">
      <div class="legend" role="list">
        <span role="listitem"><i class="swatch s1"></i> Balance (nominal)</span>
        <span role="listitem"><i class="swatch s2"></i> Balance (today's dollars)</span>
      </div>
      <svg
        [attr.viewBox]="'0 0 ' + W + ' ' + H"
        role="img"
        aria-label="Projected savings balance by year"
        (mousemove)="onMove($event)"
        (mouseleave)="hover.set(null)"
      >
        @for (tick of yTicks(); track tick.value) {
          <line [attr.x1]="PAD.left" [attr.y1]="tick.y" [attr.x2]="W - PAD.right" [attr.y2]="tick.y" class="grid" />
          <text [attr.x]="PAD.left - 8" [attr.y]="tick.y + 4" class="axis" text-anchor="end">
            {{ tick.label }}
          </text>
        }
        @for (tick of xTicks(); track tick.value) {
          <text [attr.x]="tick.x" [attr.y]="H - 8" class="axis" text-anchor="middle">
            {{ tick.value }}
          </text>
        }
        <line [attr.x1]="PAD.left" [attr.y1]="H - PAD.bottom" [attr.x2]="W - PAD.right" [attr.y2]="H - PAD.bottom" class="baseline" />
        <path [attr.d]="pathNominal()" class="line s1" />
        <path [attr.d]="pathReal()" class="line s2" />
        @if (hover(); as h) {
          <line [attr.x1]="h.x" [attr.y1]="PAD.top" [attr.x2]="h.x" [attr.y2]="H - PAD.bottom" class="crosshair" />
          <circle [attr.cx]="h.x" [attr.cy]="h.yNominal" r="4" class="dot s1" />
          <circle [attr.cx]="h.x" [attr.cy]="h.yReal" r="4" class="dot s2" />
        }
      </svg>
      @if (hover(); as h) {
        <div class="tooltip">
          <strong>Year {{ h.year.year }}</strong>
          <span><i class="swatch s1"></i>{{ fmtMoney(h.year.balance) }}</span>
          <span><i class="swatch s2"></i>{{ fmtMoney(h.year.real_balance) }}</span>
          <span class="muted">Contributed {{ fmtMoney(h.year.contribution) }} · Growth {{ fmtMoney(h.year.interest_earned) }}</span>
        </div>
      } @else {
        <div class="tooltip hint">Hover the chart for year-by-year detail.</div>
      }
    </div>
  `,
  styles: `
    .wrap {
      display: grid;
      gap: 0.4rem;
    }
    svg {
      width: 100%;
    }
    .legend {
      display: flex;
      gap: 1.25rem;
      font-size: 0.8rem;
      color: var(--text-secondary);
    }
    .swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 3px;
      margin-right: 0.4rem;
    }
    .swatch.s1, .dot.s1 { background: var(--series-1); }
    .swatch.s2, .dot.s2 { background: var(--series-2); }
    .grid { stroke: var(--gridline); stroke-width: 1; }
    .baseline { stroke: var(--baseline); stroke-width: 1; }
    .axis { font-size: 11px; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
    .line { fill: none; stroke-width: 2; }
    .line.s1 { stroke: var(--series-1); }
    .line.s2 { stroke: var(--series-2); }
    .dot.s1 { fill: var(--series-1); stroke: var(--surface-1); stroke-width: 2; }
    .dot.s2 { fill: var(--series-2); stroke: var(--surface-1); stroke-width: 2; }
    .crosshair { stroke: var(--baseline); stroke-width: 1; stroke-dasharray: 3 3; }
    .tooltip {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      font-size: 0.8rem;
      color: var(--text-primary);
      min-height: 1.2rem;
      font-variant-numeric: tabular-nums;
      align-items: center;
    }
    .tooltip .muted { color: var(--text-muted); }
    .tooltip.hint { color: var(--text-muted); }
  `,
})
export class ProjectionChartComponent {
  readonly years = input.required<ProjectionYear[]>();

  readonly W = W;
  readonly H = H;
  readonly PAD = PAD;
  readonly hover = signal<HoverInfo | null>(null);

  readonly maxY = computed(() => {
    const ys = this.years();
    return Math.max(1, ...ys.map((y) => y.balance)) * 1.05;
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
