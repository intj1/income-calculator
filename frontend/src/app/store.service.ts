import { Injectable, computed, effect, signal } from '@angular/core';
import {
  CalculationInput,
  CalculationOutput,
  ProjectionInput,
  StateListEntry,
  defaultInput,
  defaultProjectionInput,
} from './models';
import { WasmService } from './wasm.service';

const STORAGE_KEY = 'income-calculator-v1';
const THEME_KEY = 'income-calculator-theme';

interface PersistedState {
  input: CalculationInput;
  scenarioB: CalculationInput | null;
  projection: ProjectionInput;
}

/** Signal-based app state: inputs, derived results, persistence, theming. */
@Injectable({ providedIn: 'root' })
export class StoreService {
  readonly input = signal<CalculationInput>(defaultInput());
  readonly scenarioB = signal<CalculationInput | null>(null);
  readonly projection = signal<ProjectionInput>(defaultProjectionInput());
  readonly theme = signal<'system' | 'light' | 'dark'>('system');
  readonly states = signal<StateListEntry[]>([]);
  readonly taxYears = signal<number[]>([2024, 2025, 2026]);
  readonly shareCopied = signal(false);

  readonly output = computed<CalculationOutput | null>(() => {
    if (!this.wasm.ready()) return null;
    try {
      return this.wasm.calculate(this.input());
    } catch {
      return null;
    }
  });

  readonly outputB = computed<CalculationOutput | null>(() => {
    const b = this.scenarioB();
    if (!b || !this.wasm.ready()) return null;
    try {
      return this.wasm.calculate(b);
    } catch {
      return null;
    }
  });

  readonly projectionOutput = computed(() => {
    if (!this.wasm.ready()) return null;
    try {
      return this.wasm.project(this.projection());
    } catch {
      return null;
    }
  });

  /** Gross→net curve sweeping the first income source to 2.5× (min $200k
   *  annual, or $100/hr for hourly sources whose amount is a rate). */
  readonly incomeCurve = computed(() => {
    if (!this.wasm.ready()) return [];
    const input = this.input();
    const first = input.incomes[0];
    const current = first?.amount ?? 0;
    const max =
      first?.frequency === 'hourly'
        ? Math.max(100, current * 2.5)
        : Math.max(200_000, current * 2.5);
    try {
      return this.wasm.incomeCurve(input, 80, max);
    } catch {
      return [];
    }
  });

  /** Net income per state under the current scenario, sorted best-first. */
  readonly stateSweep = computed(() => {
    if (!this.wasm.ready()) return [];
    try {
      return this.wasm.stateSweep(this.input());
    } catch {
      return [];
    }
  });

  /** 401(k) contribution optimizer sweep, 0-50% of pay. */
  readonly k401Curve = computed(() => {
    if (!this.wasm.ready()) return [];
    try {
      return this.wasm.k401Curve(this.input(), 50);
    } catch {
      return [];
    }
  });

  /** Marriage bonus/penalty vs a hypothetical partner's income. */
  readonly marriageSweep = computed(() => {
    if (!this.wasm.ready()) return [];
    const input = this.input();
    const out = this.output();
    const max = Math.max(250_000, (out?.gross.total_annual ?? 0) * 2);
    try {
      return this.wasm.marriageSweep(input, 60, max);
    } catch {
      return [];
    }
  });

  constructor(private wasm: WasmService) {
    this.restore();
    this.restoreFromShareLink();
    effect(() => {
      const state: PersistedState = {
        input: this.input(),
        scenarioB: this.scenarioB(),
        projection: this.projection(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* storage unavailable (private mode) — nonfatal */
      }
    });
    effect(() => {
      const t = this.theme();
      const root = document.documentElement;
      if (t === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', t);
      try {
        localStorage.setItem(THEME_KEY, t);
      } catch {
        /* nonfatal */
      }
    });
  }

  async init(): Promise<void> {
    await this.wasm.load();
    this.states.set(this.wasm.states());
    this.taxYears.set(this.wasm.taxYears());
  }

  /** Required gross for a desired annual net, or null while WASM loads. */
  solveRequiredGross(desiredNetAnnual: number) {
    if (!this.wasm.ready() || desiredNetAnnual <= 0) return null;
    try {
      return this.wasm.solveRequiredGross(this.input(), desiredNetAnnual);
    } catch {
      return null;
    }
  }

  /** Scenario encoded into a URL that restores it on load. */
  shareLink(): string {
    const json = JSON.stringify(this.input());
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return location.origin + location.pathname + '#s=' + b64;
  }

  async copyShareLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.shareLink());
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 2000);
    } catch {
      window.prompt('Copy this link:', this.shareLink());
    }
  }

  private restoreFromShareLink(): void {
    const hash = location.hash;
    if (!hash.startsWith('#s=')) return;
    try {
      let b64 = hash.slice(3).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as CalculationInput;
      this.input.set({ ...defaultInput(), ...parsed });
      // Drop the hash so subsequent edits + reloads use localStorage state.
      history.replaceState(null, '', location.pathname + location.search);
    } catch {
      /* malformed share link — ignore */
    }
  }

  /** Merge a partial patch into the calculation input (triggers recompute). */
  patch(fn: (draft: CalculationInput) => void): void {
    const draft = structuredClone(this.input());
    fn(draft);
    this.input.set(draft);
  }

  patchB(fn: (draft: CalculationInput) => void): void {
    const current = this.scenarioB();
    if (!current) return;
    const draft = structuredClone(current);
    fn(draft);
    this.scenarioB.set(draft);
  }

  startComparison(): void {
    if (!this.scenarioB()) this.scenarioB.set(structuredClone(this.input()));
  }

  clearComparison(): void {
    this.scenarioB.set(null);
  }

  reset(): void {
    this.input.set(defaultInput());
    this.scenarioB.set(null);
    this.projection.set(defaultProjectionInput());
  }

  cycleTheme(): void {
    const order: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];
    this.theme.set(order[(order.indexOf(this.theme()) + 1) % order.length]);
  }

  exportJson(): void {
    const out = this.output();
    const blob = {
      generated_by: 'income-calculator',
      input: this.input(),
      output: out,
    };
    download(
      new Blob([JSON.stringify(blob, null, 2)], { type: 'application/json' }),
      'income-calculation.json',
    );
  }

  exportCsv(): void {
    const out = this.output();
    if (!out) return;
    const rows: string[][] = [
      ['Metric', 'Annual', 'Monthly', 'Biweekly', 'Weekly'],
      ...[
        ['Gross income', out.gross_periods] as const,
        ['Total tax', out.tax_periods] as const,
        ['Net income', out.net_periods] as const,
      ].map(([label, p]) => [
        label,
        p.annually.toFixed(2),
        p.monthly.toFixed(2),
        p.biweekly.toFixed(2),
        p.weekly.toFixed(2),
      ]),
      [],
      ['Federal income tax', out.federal_tax.toFixed(2)],
      ['State tax (' + out.state_tax.state_name + ')', out.state_tax.tax.toFixed(2)],
      ['Social Security', out.fica.social_security.toFixed(2)],
      ['Medicare', (out.fica.medicare + out.fica.additional_medicare).toFixed(2)],
      ['Self-employment tax', out.self_employment_tax.toFixed(2)],
      ['Pre-tax deductions', out.pretax_total.toFixed(2)],
      ['Post-tax deductions', out.posttax_total.toFixed(2)],
      ['Effective tax rate', (out.rates.effective_total * 100).toFixed(2) + '%'],
      ['Marginal federal rate', (out.rates.marginal_federal * 100).toFixed(2) + '%'],
    ];
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
    download(new Blob([csv], { type: 'text/csv' }), 'income-calculation.csv');
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const state = JSON.parse(raw) as PersistedState;
        // Merge over defaults so newly added fields keep sane values.
        if (state.input) this.input.set({ ...defaultInput(), ...state.input });
        if (state.scenarioB) this.scenarioB.set({ ...defaultInput(), ...state.scenarioB });
        if (state.projection)
          this.projection.set({ ...defaultProjectionInput(), ...state.projection });
      }
      const theme = localStorage.getItem(THEME_KEY);
      if (theme === 'light' || theme === 'dark' || theme === 'system') this.theme.set(theme);
    } catch {
      /* corrupted storage — start fresh */
    }
  }
}

function csvEscape(v: string | undefined): string {
  const s = v ?? '';
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
