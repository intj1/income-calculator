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
  templateUrl: './bracket-chart.html',
  styleUrl: './bracket-chart.scss',
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
