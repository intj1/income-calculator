use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum FilingStatus {
    #[default]
    Single,
    MarriedJoint,
    MarriedSeparate,
    HeadOfHousehold,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum PayFrequency {
    Hourly,
    Daily,
    Weekly,
    Biweekly,
    Semimonthly,
    Monthly,
    Quarterly,
    #[default]
    Annually,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum IncomeKind {
    #[default]
    Salary,
    Hourly,
    SelfEmployment,
    Bonus,
    Commission,
    Tips,
    Rental,
    Interest,
    Other,
}

fn default_weeks_per_year() -> f64 {
    52.0
}
fn default_hours_per_week() -> f64 {
    40.0
}
fn default_ot_multiplier() -> f64 {
    1.5
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IncomeSource {
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub kind: IncomeKind,
    /// Amount per `frequency` unit (for `Hourly` frequency this is the hourly rate).
    #[serde(default)]
    pub amount: f64,
    #[serde(default)]
    pub frequency: PayFrequency,
    #[serde(default = "default_hours_per_week")]
    pub hours_per_week: f64,
    #[serde(default = "default_weeks_per_year")]
    pub weeks_per_year: f64,
    /// Overtime only applies to hourly sources.
    #[serde(default)]
    pub overtime_hours_per_week: f64,
    #[serde(default = "default_ot_multiplier")]
    pub overtime_multiplier: f64,
}

/// Pre-tax (payroll) deductions, all expressed in dollars per YEAR unless noted.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PreTaxDeductions {
    /// Traditional 401(k) as a percent of wage income (0-100). Applied first.
    #[serde(default)]
    pub k401_percent: f64,
    /// Additional flat traditional 401(k) dollars per year.
    #[serde(default)]
    pub k401_amount: f64,
    /// Employer match: percent of salary matched (e.g. 100 = dollar-for-dollar).
    #[serde(default)]
    pub employer_match_percent: f64,
    /// Employer match cap as percent of salary (e.g. 4 = up to 4% of salary).
    #[serde(default)]
    pub employer_match_limit_percent: f64,
    #[serde(default)]
    pub traditional_ira: f64,
    #[serde(default)]
    pub hsa: f64,
    #[serde(default)]
    pub fsa: f64,
    /// Health / dental / vision insurance premiums (annual, section 125 cafeteria plan).
    #[serde(default)]
    pub health_insurance: f64,
    #[serde(default)]
    pub dental_insurance: f64,
    #[serde(default)]
    pub vision_insurance: f64,
    #[serde(default)]
    pub commuter: f64,
    #[serde(default)]
    pub other: f64,
}

/// Post-tax deductions, dollars per YEAR.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PostTaxDeductions {
    /// Roth 401(k) as percent of wage income (0-100).
    #[serde(default)]
    pub roth_401k_percent: f64,
    #[serde(default)]
    pub roth_401k_amount: f64,
    #[serde(default)]
    pub roth_ira: f64,
    #[serde(default)]
    pub life_insurance: f64,
    #[serde(default)]
    pub union_dues: f64,
    #[serde(default)]
    pub garnishments: f64,
    #[serde(default)]
    pub other: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CapitalGains {
    /// Short-term gains: taxed as ordinary income.
    #[serde(default)]
    pub short_term: f64,
    /// Long-term gains: preferential 0/15/20% brackets.
    #[serde(default)]
    pub long_term: f64,
    /// Qualified dividends: taxed like long-term gains.
    #[serde(default)]
    pub qualified_dividends: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalculationInput {
    #[serde(default)]
    pub incomes: Vec<IncomeSource>,
    #[serde(default)]
    pub filing_status: FilingStatus,
    /// Two-letter state code ("CA") or "NONE" for no state tax.
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub dependents_under_17: u32,
    #[serde(default)]
    pub other_dependents: u32,
    /// If set and larger than the standard deduction, itemized is used.
    #[serde(default)]
    pub itemized_deductions: f64,
    /// Age 50+ unlocks catch-up contribution limits.
    #[serde(default)]
    pub age_50_plus: bool,
    #[serde(default)]
    pub pretax: PreTaxDeductions,
    #[serde(default)]
    pub posttax: PostTaxDeductions,
    #[serde(default)]
    pub capital_gains: CapitalGains,
}

// ---------- Output ----------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PeriodAmounts {
    pub annually: f64,
    pub monthly: f64,
    pub semimonthly: f64,
    pub biweekly: f64,
    pub weekly: f64,
    pub daily: f64,
    pub hourly: f64,
}

impl PeriodAmounts {
    /// `hours_per_year` and `days_per_year` derive daily/hourly figures.
    pub fn from_annual(annual: f64, hours_per_year: f64, days_per_year: f64) -> Self {
        PeriodAmounts {
            annually: annual,
            monthly: annual / 12.0,
            semimonthly: annual / 24.0,
            biweekly: annual / 26.0,
            weekly: annual / 52.0,
            daily: if days_per_year > 0.0 {
                annual / days_per_year
            } else {
                0.0
            },
            hourly: if hours_per_year > 0.0 {
                annual / hours_per_year
            } else {
                0.0
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BracketSlice {
    /// Marginal rate for the slice, e.g. 0.22
    pub rate: f64,
    pub lower: f64,
    /// `None` for the top, unbounded bracket.
    pub upper: Option<f64>,
    /// Taxable income that fell into this slice.
    pub income_in_bracket: f64,
    pub tax_in_bracket: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FicaBreakdown {
    pub social_security: f64,
    pub medicare: f64,
    pub additional_medicare: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StateTaxResult {
    pub state: String,
    pub state_name: String,
    pub tax: f64,
    /// True when the state figure is a flat-rate approximation of a progressive schedule.
    pub approximate: bool,
    pub note: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeductionLine {
    pub label: String,
    pub annual: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EmployerCosts {
    pub social_security: f64,
    pub medicare: f64,
    pub futa: f64,
    pub retirement_match: f64,
    pub total_burden: f64,
    /// Gross wages + burden = true cost of employment.
    pub total_cost: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Rates {
    pub effective_federal: f64,
    pub effective_state: f64,
    pub effective_fica: f64,
    pub effective_total: f64,
    pub marginal_federal: f64,
    pub marginal_state: f64,
    pub take_home_percent: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BudgetSuggestion {
    /// 50/30/20 rule applied to monthly net income.
    pub monthly_needs: f64,
    pub monthly_wants: f64,
    pub monthly_savings: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GrossSummary {
    pub total_annual: f64,
    pub wage_annual: f64,
    pub self_employment_annual: f64,
    pub other_annual: f64,
    pub capital_gains_annual: f64,
    pub per_source: Vec<DeductionLine>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CalculationOutput {
    pub tax_year: u16,
    pub gross: GrossSummary,

    pub pretax_deductions: Vec<DeductionLine>,
    pub pretax_total: f64,
    pub posttax_deductions: Vec<DeductionLine>,
    pub posttax_total: f64,

    pub standard_deduction: f64,
    pub used_itemized: bool,
    pub federal_deduction: f64,
    pub federal_taxable_income: f64,

    pub federal_tax: f64,
    pub federal_ordinary_tax: f64,
    pub capital_gains_tax: f64,
    pub net_investment_income_tax: f64,
    pub self_employment_tax: f64,
    pub child_tax_credit: f64,
    pub other_dependent_credit: f64,

    pub fica: FicaBreakdown,
    pub state_tax: StateTaxResult,

    pub total_tax: f64,
    pub net_annual: f64,

    pub gross_periods: PeriodAmounts,
    pub net_periods: PeriodAmounts,
    pub tax_periods: PeriodAmounts,

    pub federal_brackets: Vec<BracketSlice>,
    pub rates: Rates,
    pub employer: EmployerCosts,
    pub budget: BudgetSuggestion,
    pub warnings: Vec<String>,
}

// ---------- Projection ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectionInput {
    #[serde(default)]
    pub current_balance: f64,
    /// Contribution per year (e.g. annual savings from net income).
    #[serde(default)]
    pub annual_contribution: f64,
    /// Nominal annual return, percent (e.g. 7.0).
    #[serde(default)]
    pub annual_return_percent: f64,
    /// Annual inflation, percent (e.g. 3.0).
    #[serde(default)]
    pub inflation_percent: f64,
    /// Annual contribution growth (raises), percent.
    #[serde(default)]
    pub contribution_growth_percent: f64,
    #[serde(default)]
    pub years: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectionYear {
    pub year: u32,
    pub contribution: f64,
    pub interest_earned: f64,
    pub balance: f64,
    /// Balance deflated to today's purchasing power.
    pub real_balance: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProjectionOutput {
    pub years: Vec<ProjectionYear>,
    pub final_balance: f64,
    pub final_real_balance: f64,
    pub total_contributed: f64,
    pub total_interest: f64,
}
