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
  templateUrl: './compare-bars-chart.html',
  styleUrl: './compare-bars-chart.scss',
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
