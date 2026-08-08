import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CalculationOutput } from '../models';
import { money, moneyCompact } from '../format';

interface Node {
  id: string;
  label: string;
  value: number;
  col: number;
  colorVar: string;
  x: number;
  y: number;
  h: number;
  /** Which side the label sits on. */
  labelSide: 'left' | 'right' | 'top';
}

interface Link {
  source: string;
  target: string;
  value: number;
  colorVar: string;
  path: string;
}

const W = 850;
const H = 430;
const NODE_W = 12;
const GAP = 10;
const PAD = { top: 26, bottom: 10 };
// Column x positions (left edge of each node bar).
const COL_X = [130, 350, 545, 688];

@Component({
  selector: 'app-sankey-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sankey-chart.html',
  styleUrl: './sankey-chart.scss',
})
export class SankeyChartComponent {
  readonly output = input.required<CalculationOutput>();

  readonly W = W;
  readonly H = H;
  readonly NODE_W = NODE_W;
  readonly hovered = signal<Link | null>(null);

  private layout = computed(() => {
    const out = this.output();
    const gross = out.gross.total_annual;
    if (gross <= 0) return { nodes: [] as Node[], links: [] as Link[] };

    // ---- Column 0: income sources ----
    const sources = out.gross.per_source
      .filter((s) => s.annual > 0.005)
      .map((s, i) => ({ id: 'src' + i, label: s.label, value: s.annual }));
    if (out.gross.capital_gains_annual > 0.005) {
      sources.push({
        id: 'src-gains',
        label: 'Capital gains',
        value: out.gross.capital_gains_annual,
      });
    }
    sources.sort((a, b) => b.value - a.value);

    // ---- Column 2: allocations (take-home on top, entity colors) ----
    const allocations = [
      { id: 'net', label: 'Take-home', value: out.net_annual, colorVar: '--series-1' },
      { id: 'pretax', label: 'Pre-tax savings', value: out.pretax_total, colorVar: '--series-5' },
      {
        id: 'federal',
        label: 'Federal tax',
        value: out.federal_tax + out.self_employment_tax,
        colorVar: '--series-2',
      },
      { id: 'fica', label: 'FICA', value: out.fica.total, colorVar: '--series-3' },
      { id: 'state', label: out.state_tax.state_name + ' tax', value: out.state_tax.tax, colorVar: '--series-4' },
      { id: 'posttax', label: 'Post-tax', value: out.posttax_total, colorVar: '--series-6' },
    ].filter((a) => a.value > 0.005);

    // ---- Column 3: 50/30/20 split of take-home ----
    const budget =
      out.net_annual > 0.005
        ? [
            { id: 'needs', label: 'Needs 50%', value: out.net_annual * 0.5 },
            { id: 'wants', label: 'Wants 30%', value: out.net_annual * 0.3 },
            { id: 'save', label: 'Savings 20%', value: out.net_annual * 0.2 },
          ]
        : [];

    // Shared $→px scale, sized so the tallest column fits.
    const colTotals = [
      { sum: gross, n: sources.length },
      { sum: gross, n: 1 },
      { sum: gross, n: allocations.length },
      { sum: out.net_annual, n: budget.length },
    ];
    const scale = Math.min(
      ...colTotals
        .filter((c) => c.n > 0)
        .map((c) => (H - PAD.top - PAD.bottom - GAP * (c.n - 1)) / c.sum),
    );

    const nodes: Node[] = [];
    const place = (
      items: { id: string; label: string; value: number; colorVar?: string }[],
      col: number,
      labelSide: Node['labelSide'],
      yStart: number,
      defaultColor: string,
    ) => {
      let y = yStart;
      for (const item of items) {
        const h = Math.max(2, item.value * scale);
        nodes.push({
          id: item.id,
          label: item.label,
          value: item.value,
          col,
          colorVar: item.colorVar ?? defaultColor,
          x: COL_X[col],
          y,
          h,
          labelSide,
        });
        y += h + GAP;
      }
    };

    const centerStart = (sum: number, n: number) =>
      PAD.top + Math.max(0, (H - PAD.top - PAD.bottom - (sum * scale + GAP * (n - 1))) / 2);

    place(sources, 0, 'left', centerStart(gross, sources.length), '--baseline');
    place(
      [{ id: 'gross', label: 'Gross income', value: gross, colorVar: '--series-7' }],
      1,
      'top',
      centerStart(gross, 1),
      '--series-7',
    );
    place(allocations, 2, 'right', centerStart(gross, allocations.length), '--baseline');
    // Align the budget column with the take-home node.
    const netNode = nodes.find((n) => n.id === 'net');
    if (budget.length && netNode) {
      const budgetH = out.net_annual * scale + GAP * (budget.length - 1);
      const start = Math.min(
        Math.max(PAD.top, netNode.y + netNode.h / 2 - budgetH / 2),
        H - PAD.bottom - budgetH,
      );
      place(budget, 3, 'right', start, '--series-1');
    }

    // ---- Links ----
    const links: Link[] = [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const outOffset = new Map<string, number>();
    const inOffset = new Map<string, number>();
    const connect = (sourceId: string, targetId: string, value: number, colorVar: string) => {
      const s = byId.get(sourceId);
      const t = byId.get(targetId);
      if (!s || !t || value <= 0.005) return;
      const h = value * scale;
      const sy = s.y + (outOffset.get(sourceId) ?? 0);
      const ty = t.y + (inOffset.get(targetId) ?? 0);
      outOffset.set(sourceId, (outOffset.get(sourceId) ?? 0) + h);
      inOffset.set(targetId, (inOffset.get(targetId) ?? 0) + h);
      const x0 = s.x + NODE_W;
      const x1 = t.x;
      const mx = (x0 + x1) / 2;
      const path =
        `M ${x0} ${sy.toFixed(1)} ` +
        `C ${mx} ${sy.toFixed(1)}, ${mx} ${ty.toFixed(1)}, ${x1} ${ty.toFixed(1)} ` +
        `L ${x1} ${(ty + h).toFixed(1)} ` +
        `C ${mx} ${(ty + h).toFixed(1)}, ${mx} ${(sy + h).toFixed(1)}, ${x0} ${(sy + h).toFixed(1)} Z`;
      links.push({ source: sourceId, target: targetId, value, colorVar, path });
    };

    for (const src of sources) connect(src.id, 'gross', src.value, '--series-7');
    for (const alloc of allocations) connect('gross', alloc.id, alloc.value, alloc.colorVar);
    for (const b of budget) connect('net', b.id, b.value, '--series-1');

    return { nodes, links };
  });

  readonly nodes = computed(() => this.layout().nodes);
  readonly links = computed(() => this.layout().links);

  readonly ariaLabel = computed(() => {
    const out = this.output();
    return `Money flow: ${money(out.gross.total_annual)} gross into taxes, deductions, and ${money(out.net_annual)} take-home`;
  });

  labelOf(id: string): string {
    return this.nodes().find((n) => n.id === id)?.label ?? id;
  }

  shareOf(link: Link): string {
    const gross = this.output().gross.total_annual;
    return gross > 0 ? ((link.value / gross) * 100).toFixed(1) + '%' : '—';
  }

  fmtMoney = money;
  fmtCompact = moneyCompact;
}
