//! Calculation orchestrator: gross → deductions → taxes → net.

use crate::federal::{
    self, dependent_credits, ltcg_tax, marginal_rate, ordinary_brackets, progressive_tax,
    standard_deduction,
};
use crate::fica::{employee_fica, employer_fica, self_employment_tax};
use crate::state;
use crate::types::*;

pub const K401_LIMIT: f64 = 23_500.0;
pub const K401_CATCHUP: f64 = 7_500.0;
pub const IRA_LIMIT: f64 = 7_000.0;
pub const IRA_CATCHUP: f64 = 1_000.0;
pub const HSA_LIMIT_FAMILY: f64 = 8_550.0;
pub const FSA_LIMIT: f64 = 3_300.0;

const DEFAULT_HOURS_PER_YEAR: f64 = 2_080.0;
const DEFAULT_DAYS_PER_YEAR: f64 = 260.0;

fn annual_gross(src: &IncomeSource) -> f64 {
    let base = match src.frequency {
        PayFrequency::Hourly => src.amount * src.hours_per_week * src.weeks_per_year,
        PayFrequency::Daily => src.amount * 5.0 * src.weeks_per_year,
        PayFrequency::Weekly => src.amount * src.weeks_per_year,
        PayFrequency::Biweekly => src.amount * 26.0,
        PayFrequency::Semimonthly => src.amount * 24.0,
        PayFrequency::Monthly => src.amount * 12.0,
        PayFrequency::Quarterly => src.amount * 4.0,
        PayFrequency::Annually => src.amount,
    };
    let overtime = if src.frequency == PayFrequency::Hourly {
        src.amount * src.overtime_multiplier * src.overtime_hours_per_week * src.weeks_per_year
    } else {
        0.0
    };
    (base + overtime).max(0.0)
}

pub fn calculate(input: &CalculationInput) -> CalculationOutput {
    let mut warnings: Vec<String> = Vec::new();

    // ---- 1. Annualize income sources ----
    let mut wage_annual = 0.0;
    let mut se_annual = 0.0;
    let mut other_annual = 0.0; // rental/interest: ordinary income, no FICA
    let mut investment_income = 0.0; // for NIIT
    let mut per_source = Vec::new();
    let mut hourly_hours = 0.0;

    for src in &input.incomes {
        let annual = annual_gross(src);
        per_source.push(DeductionLine {
            label: if src.label.is_empty() {
                format!("{:?}", src.kind)
            } else {
                src.label.clone()
            },
            annual,
        });
        match src.kind {
            IncomeKind::SelfEmployment => se_annual += annual,
            IncomeKind::Rental | IncomeKind::Interest => {
                other_annual += annual;
                investment_income += annual;
            }
            _ => wage_annual += annual,
        }
        if src.frequency == PayFrequency::Hourly {
            hourly_hours += (src.hours_per_week + src.overtime_hours_per_week) * src.weeks_per_year;
        }
    }

    let cg = &input.capital_gains;
    let st_gains = cg.short_term.max(0.0);
    let lt_gains = cg.long_term.max(0.0) + cg.qualified_dividends.max(0.0);
    investment_income += st_gains + lt_gains;
    let gains_annual = st_gains + lt_gains;

    let gross_total = wage_annual + se_annual + other_annual + gains_annual;

    let hours_per_year = if hourly_hours > 0.0 {
        hourly_hours
    } else {
        DEFAULT_HOURS_PER_YEAR
    };
    let days_per_year = if hourly_hours > 0.0 {
        hourly_hours / 8.0
    } else {
        DEFAULT_DAYS_PER_YEAR
    };

    // ---- 2. Pre-tax deductions ----
    let p = &input.pretax;
    let k401_limit = K401_LIMIT + if input.age_50_plus { K401_CATCHUP } else { 0.0 };
    let ira_limit = IRA_LIMIT + if input.age_50_plus { IRA_CATCHUP } else { 0.0 };

    let mut k401 = wage_annual * (p.k401_percent / 100.0).clamp(0.0, 1.0) + p.k401_amount.max(0.0);
    let mut roth_401k = wage_annual * (input.posttax.roth_401k_percent / 100.0).clamp(0.0, 1.0)
        + input.posttax.roth_401k_amount.max(0.0);
    // Traditional + Roth 401(k) share one elective deferral limit.
    if k401 + roth_401k > k401_limit {
        let over = k401 + roth_401k - k401_limit;
        warnings.push(format!(
            "401(k) contributions exceed the ${:.0} elective deferral limit by ${:.0}; clamped.",
            k401_limit, over
        ));
        // Trim Roth first, then traditional.
        let roth_cut = roth_401k.min(over);
        roth_401k -= roth_cut;
        k401 = (k401 - (over - roth_cut)).max(0.0);
    }

    let mut ira = p.traditional_ira.max(0.0);
    let mut roth_ira = input.posttax.roth_ira.max(0.0);
    if ira + roth_ira > ira_limit {
        warnings.push(format!(
            "IRA contributions exceed the ${:.0} annual limit; clamped.",
            ira_limit
        ));
        let over = ira + roth_ira - ira_limit;
        let roth_cut = roth_ira.min(over);
        roth_ira -= roth_cut;
        ira = (ira - (over - roth_cut)).max(0.0);
    }

    let mut hsa = p.hsa.max(0.0);
    if hsa > HSA_LIMIT_FAMILY {
        warnings.push(format!(
            "HSA contribution clamped to the ${:.0} family limit.",
            HSA_LIMIT_FAMILY
        ));
        hsa = HSA_LIMIT_FAMILY;
    }
    let mut fsa = p.fsa.max(0.0);
    if fsa > FSA_LIMIT {
        warnings.push(format!(
            "FSA contribution clamped to the ${:.0} limit.",
            FSA_LIMIT
        ));
        fsa = FSA_LIMIT;
    }

    let insurance =
        p.health_insurance.max(0.0) + p.dental_insurance.max(0.0) + p.vision_insurance.max(0.0);
    let cafeteria = insurance + fsa + hsa + p.commuter.max(0.0); // FICA-exempt (section 125/132)
    let pretax_lines = vec![
        DeductionLine {
            label: "Traditional 401(k)".into(),
            annual: k401,
        },
        DeductionLine {
            label: "Traditional IRA".into(),
            annual: ira,
        },
        DeductionLine {
            label: "HSA".into(),
            annual: hsa,
        },
        DeductionLine {
            label: "FSA".into(),
            annual: fsa,
        },
        DeductionLine {
            label: "Health insurance".into(),
            annual: p.health_insurance.max(0.0),
        },
        DeductionLine {
            label: "Dental insurance".into(),
            annual: p.dental_insurance.max(0.0),
        },
        DeductionLine {
            label: "Vision insurance".into(),
            annual: p.vision_insurance.max(0.0),
        },
        DeductionLine {
            label: "Commuter benefits".into(),
            annual: p.commuter.max(0.0),
        },
        DeductionLine {
            label: "Other pre-tax".into(),
            annual: p.other.max(0.0),
        },
    ];
    let mut pretax_total: f64 = pretax_lines.iter().map(|l| l.annual).sum();
    if pretax_total > wage_annual + se_annual + other_annual {
        warnings
            .push("Pre-tax deductions exceed earned income; results may be unrealistic.".into());
        pretax_total = pretax_total.min(wage_annual + se_annual + other_annual);
    }

    // ---- 3. FICA & SE tax ----
    // 401(k) does NOT reduce FICA wages; cafeteria-plan items do.
    let fica_wages = (wage_annual - cafeteria).max(0.0);
    let fica_breakdown = employee_fica(fica_wages, input.filing_status);
    let (se_tax, half_se_deduction) = self_employment_tax(se_annual, fica_wages);

    // ---- 4. Federal income tax ----
    let agi =
        (wage_annual + se_annual + other_annual + gains_annual - pretax_total - half_se_deduction)
            .max(0.0);
    let std_ded = standard_deduction(input.filing_status);
    let itemized = input.itemized_deductions.max(0.0);
    let used_itemized = itemized > std_ded;
    let federal_deduction = if used_itemized { itemized } else { std_ded };

    let taxable_total = (agi - federal_deduction).max(0.0);
    let ltcg_in_taxable = lt_gains.min(taxable_total);
    let ordinary_taxable = taxable_total - ltcg_in_taxable;

    let brackets = ordinary_brackets(input.filing_status);
    let (ordinary_tax, bracket_slices) = progressive_tax(ordinary_taxable, brackets);
    let cap_gains_tax = ltcg_tax(ordinary_taxable, ltcg_in_taxable, input.filing_status);

    // NIIT
    let niit_threshold = federal::niit_threshold(input.filing_status);
    let niit = federal::NIIT_RATE
        * investment_income
            .min((agi - niit_threshold).max(0.0))
            .max(0.0);

    // Credits (non-refundable: cannot reduce income tax below zero)
    let (mut ctc, mut odc) = dependent_credits(
        agi,
        input.dependents_under_17,
        input.other_dependents,
        input.filing_status,
    );
    let income_tax_before_credits = ordinary_tax + cap_gains_tax;
    if ctc + odc > income_tax_before_credits {
        let scale = if ctc + odc > 0.0 {
            income_tax_before_credits / (ctc + odc)
        } else {
            0.0
        };
        ctc *= scale;
        odc *= scale;
        warnings.push(
            "Dependent credits limited by federal income tax owed (non-refundable portion only)."
                .into(),
        );
    }

    let federal_tax = (income_tax_before_credits - ctc - odc).max(0.0) + niit;

    // ---- 5. State tax ----
    let state_result = state::compute(&input.state, agi, taxable_total, input.filing_status);
    if state_result.approximate {
        warnings.push(format!(
            "{} uses progressive brackets; a flat effective-rate approximation was applied.",
            state_result.state_name
        ));
    }

    // ---- 6. Post-tax deductions & net ----
    let q = &input.posttax;
    let posttax_lines = vec![
        DeductionLine {
            label: "Roth 401(k)".into(),
            annual: roth_401k,
        },
        DeductionLine {
            label: "Roth IRA".into(),
            annual: roth_ira,
        },
        DeductionLine {
            label: "Life insurance".into(),
            annual: q.life_insurance.max(0.0),
        },
        DeductionLine {
            label: "Union dues".into(),
            annual: q.union_dues.max(0.0),
        },
        DeductionLine {
            label: "Garnishments".into(),
            annual: q.garnishments.max(0.0),
        },
        DeductionLine {
            label: "Other post-tax".into(),
            annual: q.other.max(0.0),
        },
    ];
    let posttax_total: f64 = posttax_lines.iter().map(|l| l.annual).sum();

    let total_tax = federal_tax + se_tax + fica_breakdown.total + state_result.tax;
    let net_annual = gross_total - pretax_total - total_tax - posttax_total;

    // ---- 7. Rates ----
    let denom = if gross_total > 0.0 { gross_total } else { 1.0 };
    let rates = Rates {
        effective_federal: (federal_tax + se_tax) / denom,
        effective_state: state_result.tax / denom,
        effective_fica: fica_breakdown.total / denom,
        effective_total: total_tax / denom,
        marginal_federal: marginal_rate(ordinary_taxable, brackets),
        marginal_state: state::marginal_rate(&input.state, agi, input.filing_status),
        take_home_percent: if gross_total > 0.0 {
            net_annual / gross_total
        } else {
            0.0
        },
    };

    // ---- 8. Employer costs ----
    let (er_ss, er_medicare, futa) = employer_fica(fica_wages);
    let match_cap = wage_annual * (p.employer_match_limit_percent / 100.0).clamp(0.0, 1.0);
    let retirement_match =
        ((k401 + roth_401k) * (p.employer_match_percent / 100.0).max(0.0)).min(match_cap);
    let burden = er_ss + er_medicare + futa + retirement_match;
    let employer = EmployerCosts {
        social_security: er_ss,
        medicare: er_medicare,
        futa,
        retirement_match,
        total_burden: burden,
        total_cost: wage_annual + burden,
    };

    // ---- 9. Periods & budget ----
    let gross_periods = PeriodAmounts::from_annual(gross_total, hours_per_year, days_per_year);
    let net_periods = PeriodAmounts::from_annual(net_annual, hours_per_year, days_per_year);
    let tax_periods = PeriodAmounts::from_annual(total_tax, hours_per_year, days_per_year);
    let monthly_net = net_periods.monthly;
    let budget = BudgetSuggestion {
        monthly_needs: monthly_net * 0.50,
        monthly_wants: monthly_net * 0.30,
        monthly_savings: monthly_net * 0.20,
    };

    CalculationOutput {
        tax_year: federal::TAX_YEAR,
        gross: GrossSummary {
            total_annual: gross_total,
            wage_annual,
            self_employment_annual: se_annual,
            other_annual,
            capital_gains_annual: gains_annual,
            per_source,
        },
        pretax_deductions: pretax_lines,
        pretax_total,
        posttax_deductions: posttax_lines,
        posttax_total,
        standard_deduction: std_ded,
        used_itemized,
        federal_deduction,
        federal_taxable_income: taxable_total,
        federal_tax,
        federal_ordinary_tax: ordinary_tax,
        capital_gains_tax: cap_gains_tax,
        net_investment_income_tax: niit,
        self_employment_tax: se_tax,
        child_tax_credit: ctc,
        other_dependent_credit: odc,
        fica: fica_breakdown,
        state_tax: state_result,
        total_tax,
        net_annual,
        gross_periods,
        net_periods,
        tax_periods,
        federal_brackets: bracket_slices,
        rates,
        employer,
        budget,
        warnings,
    }
}

/// Compound-growth savings projection with contribution growth and inflation.
pub fn project(input: &ProjectionInput) -> ProjectionOutput {
    let r = input.annual_return_percent / 100.0;
    let infl = input.inflation_percent / 100.0;
    let growth = input.contribution_growth_percent / 100.0;
    let mut balance = input.current_balance.max(0.0);
    let mut contribution = input.annual_contribution.max(0.0);
    let mut total_contributed = 0.0;
    let mut total_interest = 0.0;
    let mut years = Vec::new();

    for year in 1..=input.years.min(100) {
        let interest = balance * r + contribution * r / 2.0; // contributions mid-year on average
        balance += contribution + interest;
        total_contributed += contribution;
        total_interest += interest;
        let real_balance = balance / (1.0 + infl).powi(year as i32);
        years.push(ProjectionYear {
            year,
            contribution,
            interest_earned: interest,
            balance,
            real_balance,
        });
        contribution *= 1.0 + growth;
    }

    ProjectionOutput {
        final_balance: balance,
        final_real_balance: years.last().map(|y| y.real_balance).unwrap_or(balance),
        total_contributed,
        total_interest,
        years,
    }
}
