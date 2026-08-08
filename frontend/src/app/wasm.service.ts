import { Injectable, signal } from '@angular/core';
import init, {
  calculate,
  income_curve,
  k401_curve,
  project,
  roth_vs_traditional,
  solve_required_gross,
  state_sweep,
  states,
  tax_years,
} from './wasm/pkg/income_calc';
import {
  CalculationInput,
  CalculationOutput,
  CurvePoint,
  K401Point,
  ProjectionInput,
  ProjectionOutput,
  RothTradInput,
  RothTradOutput,
  SolveResult,
  StateListEntry,
  StateNetEntry,
} from './models';

/** Loads the Rust/WASM calculation engine and exposes typed wrappers. */
@Injectable({ providedIn: 'root' })
export class WasmService {
  readonly ready = signal(false);
  readonly loadError = signal<string | null>(null);

  async load(): Promise<void> {
    if (this.ready()) return;
    try {
      // The .wasm binary is copied next to index.html by angular.json assets,
      // so resolve it against <base href> to survive GitHub Pages subpaths.
      await init({ module_or_path: new URL('income_calc_bg.wasm', document.baseURI) });
      this.ready.set(true);
    } catch (e) {
      this.loadError.set(String(e));
      throw e;
    }
  }

  calculate(input: CalculationInput): CalculationOutput {
    const out = JSON.parse(calculate(JSON.stringify(input)));
    if (out.error) throw new Error(out.error);
    return out as CalculationOutput;
  }

  project(input: ProjectionInput): ProjectionOutput {
    const out = JSON.parse(project(JSON.stringify(input)));
    if (out.error) throw new Error(out.error);
    return out as ProjectionOutput;
  }

  states(): StateListEntry[] {
    return JSON.parse(states()) as StateListEntry[];
  }

  taxYears(): number[] {
    return JSON.parse(tax_years()) as number[];
  }

  solveRequiredGross(input: CalculationInput, desiredNetAnnual: number): SolveResult {
    const out = JSON.parse(solve_required_gross(JSON.stringify(input), desiredNetAnnual));
    if (out.error) throw new Error(out.error);
    return out as SolveResult;
  }

  incomeCurve(input: CalculationInput, points: number, maxAmount: number): CurvePoint[] {
    const out = JSON.parse(income_curve(JSON.stringify(input), points, maxAmount));
    if (out.error) throw new Error(out.error);
    return out as CurvePoint[];
  }

  stateSweep(input: CalculationInput): StateNetEntry[] {
    const out = JSON.parse(state_sweep(JSON.stringify(input)));
    if (out.error) throw new Error(out.error);
    return out as StateNetEntry[];
  }

  k401Curve(input: CalculationInput, maxPercent: number): K401Point[] {
    const out = JSON.parse(k401_curve(JSON.stringify(input), maxPercent));
    if (out.error) throw new Error(out.error);
    return out as K401Point[];
  }

  rothVsTraditional(input: RothTradInput): RothTradOutput {
    const out = JSON.parse(roth_vs_traditional(JSON.stringify(input)));
    if (out.error) throw new Error(out.error);
    return out as RothTradOutput;
  }
}
