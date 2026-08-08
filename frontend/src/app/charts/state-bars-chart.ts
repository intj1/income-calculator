import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { StateNetEntry } from '../models';
import { money, moneyCompact } from '../format';

const W = 720;
const ROW_H = 19;
const PAD = { top: 6, right: 70, bottom: 24, left: 170 };

@Component({
  selector: 'app-state-bars-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="legend" role="list">
        <span role="listitem"><i class="swatch s1"></i> Net income</span>
        <span role="listitem"><i class="swatch s2"></i> Your state</span>
        <span role="listitem" class="muted">≈ flat-rate approximation</span>
      </div>
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + height()" role="img" aria-label="Net income by state">
        @for (entry of rows(); track entry.code; let i = $index) {
          <text
            [attr.x]="PAD.left - 8"
            [attr.y]="rowY(i) + ROW_H / 2 + 4"
            class="row-label"
            [class.current]="entry.code === currentState()"
            text-anchor="end"
          >
            {{ entry.name }}{{ entry.approximate ? ' ≈' : '' }}
          </text>
          <rect
            [attr.x]="PAD.left"
            [attr.y]="rowY(i) + 2"
            [attr.width]="barWidth(entry)"
            [attr.height]="ROW_H - 4"
            rx="4"
            [attr.fill]="entry.code === currentState() ? 'var(--series-2)' : 'var(--series-1)'"
            stroke="var(--surface-1)"
            stroke-width="2"
            (mouseenter)="hovered.set(entry)"
            (mouseleave)="hovered.set(null)"
          />
          <text
            [attr.x]="PAD.left + barWidth(entry) + 6"
            [attr.y]="rowY(i) + ROW_H / 2 + 4"
            class="value-label"
          >
            {{ fmtCompact(entry.net_annual) }}
          </text>
        }
      </svg>
      @if (!expanded() && sweep().length > limit) {
        <button type="button" class="btn ghost sm" (click)="expanded.set(true)">
          Show all {{ sweep().length }} states
        </button>
      }
      @if (hovered(); as entry) {
        <div class="tooltip">
          <strong>{{ entry.name }}</strong>
          <span>Net {{ fmtMoney(entry.net_annual) }}</span>
          <span class="muted">State tax {{ fmtMoney(entry.state_tax) }} · Total tax {{ fmtMoney(entry.total_tax) }}</span>
          @if (deltaToCurrent(entry) !== null) {
            <span [class.delta-good]="deltaToCurrent(entry)! > 0" [class.delta-bad]="deltaToCurrent(entry)! < 0">
              {{ deltaToCurrent(entry)! > 0 ? '+' : '' }}{{ fmtMoney(deltaToCurrent(entry)!) }} vs yours
            </span>
          }
        </div>
      } @else {
        <div class="tooltip hint">Your exact scenario recomputed under every state's income tax, sorted by take-home.</div>
      }
    </div>
  `,
  styles: `
    .wrap { display: grid; gap: 0.4rem; justify-items: start; }
    svg { width: 100%; }
    rect { cursor: pointer; }
    .legend { display: flex; gap: 1.25rem; font-size: 0.8rem; color: var(--text-secondary); flex-wrap: wrap; }
    .legend .muted { color: var(--text-muted); }
    .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 0.4rem; }
    .swatch.s1 { background: var(--series-1); }
    .swatch.s2 { background: var(--series-2); }
    .row-label { font-size: 11px; fill: var(--text-secondary); }
    .row-label.current { font-weight: 700; fill: var(--text-primary); }
    .value-label { font-size: 10.5px; fill: var(--text-muted); font-variant-numeric: tabular-nums; }
    .tooltip {
      display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem;
      color: var(--text-primary); min-height: 1.2rem; font-variant-numeric: tabular-nums;
    }
    .tooltip .muted { color: var(--text-muted); }
    .tooltip.hint { color: var(--text-muted); }
    .delta-good { color: var(--delta-good); font-weight: 600; }
    .delta-bad { color: var(--delta-bad); font-weight: 600; }
  `,
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
