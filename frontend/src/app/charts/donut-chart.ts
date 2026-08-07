import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { money, pct } from '../format';

export interface DonutSlice {
  label: string;
  value: number;
  /** CSS var carrying the series color — fixed per entity, never by rank. */
  colorVar: string;
}

interface Arc extends DonutSlice {
  path: string;
  share: number;
  labelX: number;
  labelY: number;
  showLabel: boolean;
}

const CX = 110;
const CY = 110;
const R_OUTER = 100;
const R_INNER = 62;

@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut-wrap">
      <svg viewBox="0 0 220 220" role="img" [attr.aria-label]="ariaLabel()">
        @for (arc of arcs(); track arc.label) {
          <path
            [attr.d]="arc.path"
            [attr.fill]="'var(' + arc.colorVar + ')'"
            stroke="var(--surface-1)"
            stroke-width="2"
            [class.dim]="hovered() !== null && hovered() !== arc.label"
            (mouseenter)="hovered.set(arc.label)"
            (mouseleave)="hovered.set(null)"
          />
        }
        @for (arc of arcs(); track arc.label) {
          @if (arc.showLabel) {
            <text [attr.x]="arc.labelX" [attr.y]="arc.labelY" class="slice-label">
              {{ fmtPct(arc.share) }}
            </text>
          }
        }
        <text [attr.x]="CX" [attr.y]="CY - 6" class="center-title">{{ centerLabel() }}</text>
        <text [attr.x]="CX" [attr.y]="CY + 16" class="center-value">{{ centerValue() }}</text>
      </svg>
      <ul class="legend">
        @for (arc of arcs(); track arc.label) {
          <li (mouseenter)="hovered.set(arc.label)" (mouseleave)="hovered.set(null)">
            <span class="swatch" [style.background]="'var(' + arc.colorVar + ')'"></span>
            <span class="name">{{ arc.label }}</span>
            <span class="val">{{ fmtMoney(arc.value) }}</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .donut-wrap {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      flex-wrap: wrap;
    }
    svg {
      width: 220px;
      flex: 0 0 auto;
    }
    path {
      transition: opacity 120ms ease;
      cursor: pointer;
    }
    path.dim {
      opacity: 0.35;
    }
    .slice-label {
      font-size: 11px;
      fill: var(--text-primary);
      text-anchor: middle;
      pointer-events: none;
    }
    .center-title {
      font-size: 11px;
      fill: var(--text-muted);
      text-anchor: middle;
    }
    .center-value {
      font-size: 17px;
      font-weight: 650;
      fill: var(--text-primary);
      text-anchor: middle;
    }
    .legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.35rem;
      min-width: 200px;
      flex: 1;
    }
    .legend li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.82rem;
      cursor: default;
    }
    .swatch {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      flex: 0 0 auto;
    }
    .name {
      color: var(--text-secondary);
      flex: 1;
    }
    .val {
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class DonutChartComponent {
  readonly slices = input.required<DonutSlice[]>();

  readonly CX = CX;
  readonly CY = CY;
  readonly hovered = signal<string | null>(null);

  readonly total = computed(() => this.slices().reduce((s, x) => s + Math.max(0, x.value), 0));

  private hoveredSlice = computed(() => {
    const h = this.hovered();
    return this.slices().find((s) => s.label === h) ?? null;
  });

  readonly centerLabel = computed(() => this.hoveredSlice()?.label ?? 'Gross total');

  readonly centerValue = computed(() => {
    const slice = this.hoveredSlice();
    return money(slice ? slice.value : this.total());
  });

  readonly ariaLabel = computed(
    () =>
      'Breakdown: ' +
      this.slices()
        .map((s) => `${s.label} ${money(s.value)}`)
        .join(', '),
  );

  readonly arcs = computed<Arc[]>(() => {
    const total = this.total();
    if (total <= 0) return [];
    let angle = -Math.PI / 2;
    return this.slices()
      .filter((s) => s.value > 0)
      .map((s) => {
        const share = s.value / total;
        const sweep = share * Math.PI * 2;
        const a0 = angle;
        const a1 = angle + sweep;
        angle = a1;
        const mid = (a0 + a1) / 2;
        const rLabel = (R_OUTER + R_INNER) / 2;
        return {
          ...s,
          share,
          path: annularSector(a0, a1),
          labelX: CX + Math.cos(mid) * rLabel,
          labelY: CY + Math.sin(mid) * rLabel + 4,
          showLabel: share >= 0.08,
        };
      });
  });

  fmtMoney = money;
  fmtPct = (v: number) => pct(v, 0);
}

function annularSector(a0: number, a1: number): string {
  // Clamp a full circle slightly so the arc renders.
  if (a1 - a0 >= Math.PI * 2) a1 = a0 + Math.PI * 2 - 0.0001;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (r: number, a: number) => `${CX + r * Math.cos(a)} ${CY + r * Math.sin(a)}`;
  return [
    `M ${p(R_OUTER, a0)}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${p(R_OUTER, a1)}`,
    `L ${p(R_INNER, a1)}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${p(R_INNER, a0)}`,
    'Z',
  ].join(' ');
}
