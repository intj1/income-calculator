import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { StateNetEntry } from '../models';
import { money, moneyCompact } from '../format';

const W = 720;
const ROW_H = 19;
const PAD = { top: 6, right: 70, bottom: 24, left: 170 };

@Component({
  selector: 'app-state-bars-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './state-bars-chart.html',
  styleUrl: './state-bars-chart.scss',
})
export class StateBarsChartComponent {
  readonly sweep = input.required<StateNetEntry[]>();
  readonly currentState = input('NONE');

  readonly W = W;
  readonly ROW_H = ROW_H;
  readonly PAD = PAD;
  readonly limit = 15;
  readonly expanded = signal(false);
  readonly hovered = signal<StateNetEntry | null>(null);

  /** Collapsed: top N plus the current state (if it fell below the fold). */
  readonly rows = computed<StateNetEntry[]>(() => {
    const all = this.sweep();
    if (this.expanded() || all.length <= this.limit) return all;
    const top = all.slice(0, this.limit);
    const current = all.find((e) => e.code === this.currentState());
    if (current && !top.includes(current)) top.push(current);
    return top;
  });

  readonly height = computed(() => PAD.top + this.rows().length * ROW_H + PAD.bottom);

  readonly maxNet = computed(() => Math.max(1, ...this.sweep().map((e) => e.net_annual)));

  rowY(i: number): number {
    return PAD.top + i * ROW_H;
  }

  barWidth(entry: StateNetEntry): number {
    return Math.max(2, (entry.net_annual / this.maxNet()) * (W - PAD.left - PAD.right));
  }

  deltaToCurrent(entry: StateNetEntry): number | null {
    const current = this.sweep().find((e) => e.code === this.currentState());
    if (!current || current.code === entry.code) return null;
    return entry.net_annual - current.net_annual;
  }

  fmtMoney = money;
  fmtCompact = moneyCompact;
}
