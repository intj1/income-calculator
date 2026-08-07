import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { BracketSlice } from '../models';
import { money, moneyCompact, pct } from '../format';

interface Segment {
  slice: BracketSlice;
  x: number;
  width: number;
  color: string;
  showLabel: boolean;
}

const W = 720;
const BAR_H = 36;
const H = 92;

// Sequential ordinal ramp (blue), light steps 250→550: nearest-surface step
// clears 2:1 per the palette's ordinal rule. Dark variants set in CSS.
const RAMP_VARS = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6', '--seq-7'];

@Component({
  selector: 'app-bracket-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" aria-label="Federal tax brackets">
        @for (seg of segments(); track seg.slice.lower) {
          <rect
            [attr.x]="seg.x"
            y="28"
            [attr.width]="seg.width"
            [attr.height]="BAR_H"
            rx="4"
            [attr.fill]="'var(' + seg.color + ')'"
            stroke="var(--surface-1)"
            stroke-width="2"
            (mouseenter)="hovered.set(seg)"
            (mouseleave)="hovered.set(null)"
          />
          @if (seg.showLabel) {
            <text [attr.x]="seg.x + seg.width / 2" y="20" class="rate-label">
              {{ fmtRate(seg.slice.rate) }}
            </text>
          }
        }
        <line x1="0" [attr.y1]="28 + BAR_H + 6" [attr.x2]="W" [attr.y2]="28 + BAR_H + 6" class="baseline" />
        <text x="0" [attr.y]="H - 6" class="axis-label" text-anchor="start">$0</text>
        <text [attr.x]="W" [attr.y]="H - 6" class="axis-label" text-anchor="end">
          {{ fmtCompact(taxable()) }}
        </text>
      </svg>
      @if (hovered(); as seg) {
        <div class="tooltip">
          <strong>{{ fmtRate(seg.slice.rate) }} bracket</strong>
          <span>
            {{ fmtMoney(seg.slice.lower) }} –
            {{ seg.slice.upper === null ? '∞' : fmtMoney(seg.slice.upper) }}
          </span>
          <span>Income here: {{ fmtMoney(seg.slice.income_in_bracket) }}</span>
          <span>Tax here: {{ fmtMoney(seg.slice.tax_in_bracket) }}</span>
        </div>
      } @else {
        <div class="tooltip hint">Hover a segment: how your taxable income fills each federal bracket.</div>
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
    rect {
      cursor: pointer;
    }
    .rate-label {
      font-size: 12px;
      fill: var(--text-secondary);
      text-anchor: middle;
    }
    .axis-label {
      font-size: 11px;
      fill: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }
    .baseline {
      stroke: var(--baseline);
      stroke-width: 1;
    }
    .tooltip {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      font-size: 0.8rem;
      color: var(--text-secondary);
      min-height: 1.2rem;
      font-variant-numeric: tabular-nums;
    }
    .tooltip strong {
      color: var(--text-primary);
    }
    .tooltip.hint {
      color: var(--text-muted);
    }
  `,
})
export class BracketChartComponent {
  readonly brackets = input.required<BracketSlice[]>();

  readonly W = W;
  readonly H = H;
  readonly BAR_H = BAR_H;
  readonly hovered = signal<Segment | null>(null);

  readonly taxable = computed(() =>
    this.brackets().reduce((s, b) => s + b.income_in_bracket, 0),
  );

  readonly segments = computed<Segment[]>(() => {
    const total = this.taxable();
    if (total <= 0) return [];
    let x = 0;
    return this.brackets().map((slice, i) => {
      const width = (slice.income_in_bracket / total) * W;
      const seg: Segment = {
        slice,
        x,
        width,
        color: RAMP_VARS[Math.min(i, RAMP_VARS.length - 1)],
        showLabel: width > 44,
      };
      x += width;
      return seg;
    });
  });

  fmtRate = (r: number) => pct(r, 0);
  fmtMoney = money;
  fmtCompact = moneyCompact;
}
