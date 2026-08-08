import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CalculationOutput } from '../models';
import { money, moneyCompact } from '../format';

interface Step {
  label: string;
  /** Negative = money removed. */
  delta: number;
  /** Bar geometry (running totals). */
  from: number;
  to: number;
  colorVar: string;
  isAnchor: boolean; // gross / net full-height bars
}

const W = 720;
const H = 300;
const PAD = { top: 24, right: 12, bottom: 44, left: 56 };

@Component({
  selector: 'app-waterfall-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" aria-label="From gross to net, step by step">
        @for (tick of yTicks(); track tick.value) {
          <line [attr.x1]="PAD.left" [attr.y1]="tick.y" [attr.x2]="W - PAD.right" [attr.y2]="tick.y" class="grid" />
          <text [attr.x]="PAD.left - 8" [attr.y]="tick.y + 4" class="axis" text-anchor="end">{{ tick.label }}</text>
        }
        @for (step of steps(); track step.label; let i = $index) {
          <rect
            [attr.x]="x(i)"
            [attr.y]="y(step.to > step.from ? step.to : step.from)"
            [attr.width]="barWidth()"
            [attr.height]="barHeight(step)"
            rx="4"
            [attr.fill]="'var(' + step.colorVar + ')'"
            stroke="var(--surface-1)"
            stroke-width="2"
            (mouseenter)="hovered.set(step)"
            (mouseleave)="hovered.set(null)"
          />
          <!-- connector to the next bar -->
          @if (i < steps().length - 1) {
            <line
              [attr.x1]="x(i) + barWidth()"
              [attr.y1]="y(step.to)"
              [attr.x2]="x(i + 1)"
              [attr.y2]="y(step.to)"
              class="connector"
            />
          }
          <text [attr.x]="x(i) + barWidth() / 2" [attr.y]="H - PAD.bottom + 16" class="axis" text-anchor="middle">
            {{ step.label }}
          </text>
          <text
            [attr.x]="x(i) + barWidth() / 2"
            [attr.y]="y(step.to > step.from ? step.to : step.from) - 6"
            class="bar-label"
            text-anchor="middle"
          >
            {{ step.isAnchor ? fmtCompact(step.to) : fmtCompact(step.delta) }}
          </text>
        }
        <line [attr.x1]="PAD.left" [attr.y1]="y(0)" [attr.x2]="W - PAD.right" [attr.y2]="y(0)" class="baseline" />
      </svg>
      @if (hovered(); as step) {
        <div class="tooltip">
          <strong>{{ step.label }}</strong>
          <span>{{ step.isAnchor ? fmtMoney(step.to) : fmtMoney(step.delta) }}</span>
          @if (!step.isAnchor) {
            <span class="muted">Running total: {{ fmtMoney(step.to) }}</span>
          }
        </div>
      } @else {
        <div class="tooltip hint">Each bar removes a slice from gross until only take-home remains.</div>
      }
    </div>
  `,
  styles: `
    .wrap { display: grid; gap: 0.4rem; }
    svg { width: 100%; }
    rect { cursor: pointer; }
    .grid { stroke: var(--gridline); stroke-width: 1; }
    .baseline { stroke: var(--baseline); stroke-width: 1; }
    .connector { stroke: var(--baseline); stroke-width: 1; stroke-dasharray: 2 3; }
    .axis { font-size: 11px; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
    .bar-label { font-size: 11px; fill: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .tooltip {
      display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem;
      color: var(--text-primary); min-height: 1.2rem; font-variant-numeric: tabular-nums;
    }
    .tooltip .muted { color: var(--text-muted); }
    .tooltip.hint { color: var(--text-muted); }
  `,
})
export class WaterfallChartComponent {
  readonly output = input.required<CalculationOutput>();

  readonly W = W;
  readonly H = H;
  readonly PAD = PAD;
  readonly hovered = signal<Step | null>(null);

  // Color follows the entity — same assignments as the donut.
  readonly steps = computed<Step[]>(() => {
    const out = this.output();
    const gross = out.gross.total_annual;
    let running = gross;
    const steps: Step[] = [
      { label: 'Gross', delta: gross, from: 0, to: gross, colorVar: '--series-7', isAnchor: true },
    ];
    const push = (label: string, amount: number, colorVar: string) => {
      if (amount <= 0.005) return;
      const from = running;
      running -= amount;
      steps.push({ label, delta: -amount, from, to: running, colorVar, isAnchor: false });
    };
    push('Pre-tax', out.pretax_total, '--series-5');
    push('Federal', out.federal_tax + out.self_employment_tax, '--series-2');
    push('FICA', out.fica.total, '--series-3');
    push('State', out.state_tax.tax, '--series-4');
    push('Post-tax', out.posttax_total, '--series-6');
    steps.push({
      label: 'Take-home',
      delta: running,
      from: 0,
      to: running,
      colorVar: '--series-1',
      isAnchor: true,
    });
    return steps;
  });

  readonly maxY = computed(() => Math.max(1, this.output().gross.total_annual) * 1.06);

  barWidth(): number {
    const n = this.steps().length;
    return ((W - PAD.left - PAD.right) / n) * 0.68;
  }

  x(i: number): number {
    const n = this.steps().length;
    const slot = (W - PAD.left - PAD.right) / n;
    return PAD.left + slot * i + (slot - this.barWidth()) / 2;
  }

  y(value: number): number {
    return H - PAD.bottom - (value / this.maxY()) * (H - PAD.top - PAD.bottom);
  }

  barHeight(step: Step): number {
    return Math.max(1.5, Math.abs(this.y(step.from) - this.y(step.to)));
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
  fmtCompact = moneyCompact;
}

function niceStep(raw: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, raw))));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
