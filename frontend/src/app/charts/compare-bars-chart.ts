import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CalculationOutput } from '../models';
import { money, moneyCompact } from '../format';

interface Group {
  label: string;
  a: number;
  b: number;
}

const W = 720;
const H = 250;
const PAD = { top: 22, right: 12, bottom: 30, left: 56 };

@Component({
  selector: 'app-compare-bars-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="legend" role="list">
        <span role="listitem"><i class="swatch s1"></i> Scenario A (current)</span>
        <span role="listitem"><i class="swatch s2"></i> Scenario B (what-if)</span>
      </div>
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" aria-label="Scenario A versus B">
        @for (tick of yTicks(); track tick.value) {
          <line [attr.x1]="PAD.left" [attr.y1]="tick.y" [attr.x2]="W - PAD.right" [attr.y2]="tick.y" class="grid" />
          <text [attr.x]="PAD.left - 8" [attr.y]="tick.y + 4" class="axis" text-anchor="end">{{ tick.label }}</text>
        }
        @for (group of groups(); track group.label; let i = $index) {
          <rect
            [attr.x]="xBar(i, 0)" [attr.y]="y(group.a)" [attr.width]="barW()" [attr.height]="y(0) - y(group.a)"
            rx="4" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"
            (mouseenter)="hovered.set(group)" (mouseleave)="hovered.set(null)"
          />
          <rect
            [attr.x]="xBar(i, 1)" [attr.y]="y(group.b)" [attr.width]="barW()" [attr.height]="y(0) - y(group.b)"
            rx="4" fill="var(--series-2)" stroke="var(--surface-1)" stroke-width="2"
            (mouseenter)="hovered.set(group)" (mouseleave)="hovered.set(null)"
          />
          <text [attr.x]="xGroupCenter(i)" [attr.y]="H - 8" class="axis" text-anchor="middle">{{ group.label }}</text>
        }
        <line [attr.x1]="PAD.left" [attr.y1]="y(0)" [attr.x2]="W - PAD.right" [attr.y2]="y(0)" class="baseline" />
      </svg>
      @if (hovered(); as group) {
        <div class="tooltip">
          <strong>{{ group.label }}</strong>
          <span><i class="swatch s1"></i>{{ fmtMoney(group.a) }}</span>
          <span><i class="swatch s2"></i>{{ fmtMoney(group.b) }}</span>
          <span class="muted">Δ {{ fmtMoney(group.b - group.a) }}</span>
        </div>
      } @else {
        <div class="tooltip hint">Hover a pair of bars for exact values.</div>
      }
    </div>
  `,
  styles: `
    .wrap { display: grid; gap: 0.4rem; }
    svg { width: 100%; }
    rect { cursor: pointer; }
    .legend { display: flex; gap: 1.25rem; font-size: 0.8rem; color: var(--text-secondary); }
    .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 0.4rem; }
    .swatch.s1 { background: var(--series-1); }
    .swatch.s2 { background: var(--series-2); }
    .grid { stroke: var(--gridline); stroke-width: 1; }
    .baseline { stroke: var(--baseline); stroke-width: 1; }
    .axis { font-size: 11px; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
    .tooltip {
      display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; align-items: center;
      color: var(--text-primary); min-height: 1.2rem; font-variant-numeric: tabular-nums;
    }
    .tooltip .muted { color: var(--text-muted); }
    .tooltip.hint { color: var(--text-muted); }
  `,
})
export class CompareBarsChartComponent {
  readonly outputA = input.required<CalculationOutput>();
  readonly outputB = input.required<CalculationOutput>();

  readonly W = W;
  readonly H = H;
  readonly PAD = PAD;
  readonly hovered = signal<Group | null>(null);

  readonly groups = computed<Group[]>(() => {
    const a = this.outputA();
    const b = this.outputB();
    return [
      { label: 'Gross', a: a.gross.total_annual, b: b.gross.total_annual },
      { label: 'Total tax', a: a.total_tax, b: b.total_tax },
      { label: 'Deductions', a: a.pretax_total + a.posttax_total, b: b.pretax_total + b.posttax_total },
      { label: 'Net income', a: a.net_annual, b: b.net_annual },
    ];
  });

  readonly maxY = computed(
    () => Math.max(1, ...this.groups().flatMap((g) => [g.a, g.b])) * 1.08,
  );

  barW(): number {
    const n = this.groups().length;
    const slot = (W - PAD.left - PAD.right) / n;
    return slot * 0.28;
  }

  xBar(i: number, which: 0 | 1): number {
    const n = this.groups().length;
    const slot = (W - PAD.left - PAD.right) / n;
    const center = PAD.left + slot * i + slot / 2;
    return which === 0 ? center - this.barW() - 2 : center + 2;
  }

  xGroupCenter(i: number): number {
    const n = this.groups().length;
    const slot = (W - PAD.left - PAD.right) / n;
    return PAD.left + slot * i + slot / 2;
  }

  y(value: number): number {
    return H - PAD.bottom - (value / this.maxY()) * (H - PAD.top - PAD.bottom);
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
}

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
