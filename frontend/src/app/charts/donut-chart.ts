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
  templateUrl: './donut-chart.html',
  styleUrl: './donut-chart.scss',
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
