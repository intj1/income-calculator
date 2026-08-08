// TypeScript mirrors of the Rust core's serde types.

export type FilingStatus = 'single' | 'married_joint' | 'married_separate' | 'head_of_household';
export type PayFrequency =
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'semimonthly'
  | 'monthly'
  | 'quarterly'
  | 'annually';
export type IncomeKind =
  | 'salary'
  | 'hourly'
  | 'self_employment'
  | 'bonus'
  | 'commission'
  | 'tips'
  | 'rental'
  | 'interest'
  | 'other';

export interface IncomeSource {
  label: string;
  kind: IncomeKind;
  amount: number;
  frequency: PayFrequency;
  hours_per_week: number;
  weeks_per_year: number;
  overtime_hours_per_week: number;
  overtime_multiplier: number;
}

export interface PreTaxDeductions {
  k401_percent: number;
  k401_amount: number;
  employer_match_percent: number;
  employer_match_limit_percent: number;
  traditional_ira: number;
  hsa: number;
  fsa: number;
  health_insurance: number;
  dental_insurance: number;
  vision_insurance: number;
  commuter: number;
  other: number;
}

export interface PostTaxDeductions {
  roth_401k_percent: number;
  roth_401k_amount: number;
  roth_ira: number;
  life_insurance: number;
  union_dues: number;
  garnishments: number;
  other: number;
}

export interface CapitalGains {
  short_term: number;
  long_term: number;
  qualified_dividends: number;
}

export interface CalculationInput {
  tax_year: number;
  incomes: IncomeSource[];
  filing_status: FilingStatus;
  state: string;
  dependents_under_17: number;
  other_dependents: number;
  itemized_deductions: number;
  age_50_plus: boolean;
  pretax: PreTaxDeductions;
  posttax: PostTaxDeductions;
  capital_gains: CapitalGains;
}

export interface PeriodAmounts {
  annually: number;
  monthly: number;
  semimonthly: number;
  biweekly: number;
  weekly: number;
  daily: number;
  hourly: number;
}

export interface BracketSlice {
  rate: number;
  lower: number;
  upper: number | null;
  income_in_bracket: number;
  tax_in_bracket: number;
}

export interface FicaBreakdown {
  social_security: number;
  medicare: number;
  additional_medicare: number;
  total: number;
}

export interface StateTaxResult {
  state: string;
  state_name: string;
  tax: number;
  approximate: boolean;
  note: string;
}

export interface DeductionLine {
  label: string;
  annual: number;
}

export interface EmployerCosts {
  social_security: number;
  medicare: number;
  futa: number;
  retirement_match: number;
  total_burden: number;
  total_cost: number;
}

export interface Rates {
  effective_federal: number;
  effective_state: number;
  effective_fica: number;
  effective_total: number;
  marginal_federal: number;
  marginal_state: number;
  take_home_percent: number;
}

export interface BudgetSuggestion {
  monthly_needs: number;
  monthly_wants: number;
  monthly_savings: number;
}

export interface GrossSummary {
  total_annual: number;
  wage_annual: number;
  self_employment_annual: number;
  other_annual: number;
  capital_gains_annual: number;
  per_source: DeductionLine[];
}

export interface Insight {
  title: string;
  detail: string;
  annual_value: number;
}

export interface SolveResult {
  required_amount: number;
  required_gross_annual: number;
  achieved_net_annual: number;
}

export interface CurvePoint {
  amount: number;
  gross_annual: number;
  net_annual: number;
  total_tax: number;
  effective_rate: number;
  marginal_rate: number;
}

export interface StateNetEntry {
  code: string;
  name: string;
  net_annual: number;
  state_tax: number;
  total_tax: number;
  approximate: boolean;
  no_tax: boolean;
}

export interface CalculationOutput {
  tax_year: number;
  gross: GrossSummary;
  pretax_deductions: DeductionLine[];
  pretax_total: number;
  posttax_deductions: DeductionLine[];
  posttax_total: number;
  standard_deduction: number;
  used_itemized: boolean;
  federal_deduction: number;
  federal_taxable_income: number;
  federal_tax: number;
  federal_ordinary_tax: number;
  capital_gains_tax: number;
  net_investment_income_tax: number;
  self_employment_tax: number;
  child_tax_credit: number;
  other_dependent_credit: number;
  fica: FicaBreakdown;
  state_tax: StateTaxResult;
  total_tax: number;
  net_annual: number;
  gross_periods: PeriodAmounts;
  net_periods: PeriodAmounts;
  tax_periods: PeriodAmounts;
  federal_brackets: BracketSlice[];
  rates: Rates;
  employer: EmployerCosts;
  budget: BudgetSuggestion;
  tips_deduction: number;
  overtime_deduction: number;
  insights: Insight[];
  warnings: string[];
}

export interface ProjectionInput {
  current_balance: number;
  annual_contribution: number;
  annual_return_percent: number;
  inflation_percent: number;
  contribution_growth_percent: number;
  years: number;
  return_volatility_percent: number;
  target_balance: number;
}

export interface ProjectionYear {
  year: number;
  contribution: number;
  interest_earned: number;
  balance: number;
  real_balance: number;
  p10: number;
  p90: number;
}

export interface ProjectionOutput {
  years: ProjectionYear[];
  final_balance: number;
  final_real_balance: number;
  total_contributed: number;
  total_interest: number;
  target_year_reached: number | null;
  target_probability: number;
}

export interface StateListEntry {
  code: string;
  name: string;
  approximate: boolean;
  no_tax: boolean;
}

export function defaultIncomeSource(): IncomeSource {
  return {
    label: 'Primary job',
    kind: 'salary',
    amount: 85000,
    frequency: 'annually',
    hours_per_week: 40,
    weeks_per_year: 52,
    overtime_hours_per_week: 0,
    overtime_multiplier: 1.5,
  };
}

export function defaultInput(): CalculationInput {
  return {
    tax_year: 2025,
    incomes: [defaultIncomeSource()],
    filing_status: 'single',
    state: 'NONE',
    dependents_under_17: 0,
    other_dependents: 0,
    itemized_deductions: 0,
    age_50_plus: false,
    pretax: {
      k401_percent: 0,
      k401_amount: 0,
      employer_match_percent: 0,
      employer_match_limit_percent: 0,
      traditional_ira: 0,
      hsa: 0,
      fsa: 0,
      health_insurance: 0,
      dental_insurance: 0,
      vision_insurance: 0,
      commuter: 0,
      other: 0,
    },
    posttax: {
      roth_401k_percent: 0,
      roth_401k_amount: 0,
      roth_ira: 0,
      life_insurance: 0,
      union_dues: 0,
      garnishments: 0,
      other: 0,
    },
    capital_gains: { short_term: 0, long_term: 0, qualified_dividends: 0 },
  };
}

export function defaultProjectionInput(): ProjectionInput {
  return {
    current_balance: 10000,
    annual_contribution: 12000,
    annual_return_percent: 7,
    inflation_percent: 3,
    contribution_growth_percent: 2,
    years: 30,
    return_volatility_percent: 15,
    target_balance: 0,
  };
}
