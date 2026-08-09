//! Calculation orchestrator: gross → deductions → taxes → net.

use crate::federal::{
    self, dependent_credits, ltcg_tax, marginal_rate, obbba_deductions, ordinary_brackets,
    progressive_tax, standard_deduction,
};
use crate::fica::{employee_fica, employer_fica, self_employment_tax};
use crate::state;
use crate::types::*;

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

/// The "premium" half of overtime pay: the part above the regular rate
/// (rate × (multiplier − 1) × OT hours). This is what the OBBBA overtime
/// deduction applies to.
fn overtime_premium(src: &IncomeSource) -> f64 {
    if src.frequency != PayFrequency::Hourly {
        return 0.0;
    }
    (src.amount
        * (src.overtime_multiplier - 1.0).max(0.0)
        * src.overtime_hours_per_week
        * src.weeks_per_year)
        .max(0.0)
}

pub fn calculate(input: &CalculationInput) -> CalculationOutput {
    let data = federal::for_year(input.tax_year);
    let mut warnings: Vec<String> = Vec::new();

    // ---- 1. Annualize income sources ----
    let mut wage_annual = 0.0;
    let mut se_annual = 0.0;
    let mut other_annual = 0.0; // rental/interest: ordinary income, no FICA
    let mut investment_income = 0.0; // for NIIT
    let mut tips_annual = 0.0;
    let mut ot_premium_annual = 0.0;
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
            IncomeKind::Tips => {
                wage_annual += annual;
                tips_annual += annual;
            }
            _ => wage_annual += annual,
        }
        if src.frequency == PayFrequency::Hourly {
            hourly_hours += (src.hours_per_week + src.overtime_hours_per_week) * src.weeks_per_year;
            ot_premium_annual += overtime_premium(src);
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
    let k401_limit = data.k401_limit
        + if input.age_50_plus {
            data.k401_catchup
        } else {
            0.0
        };
    let ira_limit = data.ira_limit
        + if input.age_50_plus {
            data.ira_catchup
        } else {
            0.0
        };

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
    if hsa > data.hsa_limit_family {
        warnings.push(format!(
            "HSA contribution clamped to the ${:.0} family limit.",
            data.hsa_limit_family
        ));
        hsa = data.hsa_limit_family;
    }
    let mut fsa = p.fsa.max(0.0);
    if fsa > data.fsa_limit {
        warnings.push(format!(
            "FSA contribution clamped to the ${:.0} limit.",
            data.fsa_limit
        ));
        fsa = data.fsa_limit;
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
    let fica_breakdown = employee_fica(fica_wages, input.filing_status, data.ss_wage_base);
    let (se_tax, half_se_deduction) = self_employment_tax(se_annual, fica_wages, data.ss_wage_base);

    // ---- 4. Federal income tax ----
    let agi =
        (wage_annual + se_annual + other_annual + gains_annual - pretax_total - half_se_deduction)
            .max(0.0);
    let std_ded = standard_deduction(data, input.filing_status);
    let itemized = input.itemized_deductions.max(0.0);
    let used_itemized = itemized > std_ded;
    let federal_deduction = if used_itemized { itemized } else { std_ded };

    // OBBBA tips / overtime-premium deductions (2025-2028), below the line
    // but available on top of the standard deduction.
    let (tips_ded, ot_ded) = obbba_deductions(
        data,
        tips_annual,
        ot_premium_annual,
        agi,
        input.filing_status,
    );

    let taxable_total = (agi - federal_deduction - tips_ded - ot_ded).max(0.0);
    let ltcg_in_taxable = lt_gains.min(taxable_total);
    let ordinary_taxable = taxable_total - ltcg_in_taxable;

    let brackets = ordinary_brackets(data, input.filing_status);
    let (ordinary_tax, bracket_slices) = progressive_tax(ordinary_taxable, brackets);
    let cap_gains_tax = ltcg_tax(data, ordinary_taxable, ltcg_in_taxable, input.filing_status);

    // NIIT
    let niit_threshold = federal::niit_threshold(input.filing_status);
    let niit = federal::NIIT_RATE
        * investment_income
            .min((agi - niit_threshold).max(0.0))
            .max(0.0);

    // Credits (non-refundable: cannot reduce income tax below zero)
    let (mut ctc, mut odc) = dependent_credits(
        data,
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
    let marginal_federal = marginal_rate(ordinary_taxable, brackets);
    let marginal_state = state::marginal_rate(&input.state, agi, input.filing_status);
    let rates = Rates {
        effective_federal: (federal_tax + se_tax) / denom,
        effective_state: state_result.tax / denom,
        effective_fica: fica_breakdown.total / denom,
        effective_total: total_tax / denom,
        marginal_federal,
        marginal_state,
        take_home_percent: if gross_total > 0.0 {
            net_annual / gross_total
        } else {
            0.0
        },
    };

    // ---- 8. Employer costs ----
    let (er_ss, er_medicare, futa) = employer_fica(fica_wages, data.ss_wage_base);
    // "X% match up to Y% of salary": the employer matches X% of employee
    // contributions, counting contributions only up to Y% of salary.
    let match_cap = wage_annual * (p.employer_match_limit_percent / 100.0).clamp(0.0, 1.0);
    let retirement_match =
        (k401 + roth_401k).min(match_cap) * (p.employer_match_percent / 100.0).max(0.0);
    let burden = er_ss + er_medicare + futa + retirement_match;
    let employer = EmployerCosts {
        social_security: er_ss,
        medicare: er_medicare,
        futa,
        retirement_match,
        total_burden: burden,
        total_cost: wage_annual + burden,
    };

    // ---- 9. Insights ----
    let mut insights: Vec<Insight> = Vec::new();
    if wage_annual > 0.0 {
        // Unclaimed employer match: free money left on the table.
        if p.employer_match_percent > 0.0 && p.employer_match_limit_percent > 0.0 {
            let max_match = match_cap * (p.employer_match_percent / 100.0).max(0.0);
            let unclaimed = max_match - retirement_match;
            if unclaimed > 1.0 {
                insights.push(Insight {
                    title: "Unclaimed employer match".into(),
                    detail: format!(
                        "Raising your 401(k) contribution to at least {:.1}% of pay would capture the full employer match — that's free money.",
                        p.employer_match_limit_percent
                    ),
                    annual_value: unclaimed,
                });
            }
        }
        // 401(k) headroom → tax deferral at the marginal rate.
        let k401_headroom = k401_limit - (k401 + roth_401k);
        if k401_headroom > 100.0 {
            let saving = k401_headroom * (marginal_federal + marginal_state);
            insights.push(Insight {
                title: "401(k) headroom".into(),
                detail: format!(
                    "You could defer ${:.0} more into a traditional 401(k) this year, cutting roughly this much off your tax bill at your marginal rate.",
                    k401_headroom
                ),
                annual_value: saving,
            });
        }
        // HSA headroom: also avoids FICA via payroll.
        let hsa_headroom = data.hsa_limit_family - hsa;
        if hsa_headroom > 100.0 {
            let saving = hsa_headroom * (marginal_federal + marginal_state + 0.0765);
            insights.push(Insight {
                title: "HSA headroom".into(),
                detail: format!(
                    "Up to ${:.0} more HSA room (family limit). Payroll HSA contributions skip income tax AND FICA — the only triple-tax-free account.",
                    hsa_headroom
                ),
                annual_value: saving,
            });
        }
    }

    // ---- 10. Periods & budget ----
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
        tax_year: data.year,
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
        tips_deduction: tips_ded,
        overtime_deduction: ot_ded,
        insights,
        warnings,
    }
}

/// Solve for the first income source's amount needed to reach a desired
/// annual net income, holding everything else (state, deductions, other
/// sources) fixed. Percent-based deductions scale with the answer.
pub fn solve_required_gross(base: &CalculationInput, desired_net_annual: f64) -> SolveResult {
    let mut input = base.clone();
    if input.incomes.is_empty() {
        input.incomes.push(IncomeSource {
            label: "Salary".into(),
            kind: IncomeKind::Salary,
            amount: 0.0,
            frequency: PayFrequency::Annually,
            hours_per_week: 40.0,
            weeks_per_year: 52.0,
            overtime_hours_per_week: 0.0,
            overtime_multiplier: 1.5,
        });
    }
    let desired = desired_net_annual.max(0.0);
    // Net income is monotonically increasing in the first source's amount.
    let mut lo = 0.0f64;
    let mut hi = 50_000_000.0f64;
    for _ in 0..80 {
        let mid = (lo + hi) / 2.0;
        input.incomes[0].amount = mid;
        let net = calculate(&input).net_annual;
        if net < desired {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    input.incomes[0].amount = hi;
    let out = calculate(&input);
    SolveResult {
        required_amount: hi,
        required_gross_annual: out.gross.total_annual,
        achieved_net_annual: out.net_annual,
    }
}

/// Sweep the first income source's amount from 0 to `max_amount` and return
/// the gross→net curve with effective and combined marginal rates. Powers the
/// "how your take-home scales" chart.
pub fn income_curve(base: &CalculationInput, points: usize, max_amount: f64) -> Vec<CurvePoint> {
    let mut input = base.clone();
    if input.incomes.is_empty() {
        return Vec::new();
    }
    let n = points.clamp(2, 400);
    let max = if max_amount > 0.0 {
        max_amount
    } else {
        300_000.0
    };
    let mut curve = Vec::with_capacity(n);
    for i in 0..n {
        let amount = max * i as f64 / (n - 1) as f64;
        input.incomes[0].amount = amount;
        let out = calculate(&input);
        curve.push(CurvePoint {
            amount,
            gross_annual: out.gross.total_annual,
            net_annual: out.net_annual,
            total_tax: out.total_tax,
            effective_rate: out.rates.effective_total,
            marginal_rate: out.rates.marginal_federal + out.rates.marginal_state,
        });
    }
    curve
}

/// Recompute the scenario in every state (incl. "no state") and return net
/// income per state, sorted highest-net first. Powers the state comparison
/// chart.
pub fn state_sweep(base: &CalculationInput) -> Vec<StateNetEntry> {
    let mut input = base.clone();
    let mut entries: Vec<StateNetEntry> = state::all_states()
        .iter()
        .map(|s| {
            input.state = s.code.to_string();
            let out = calculate(&input);
            StateNetEntry {
                code: s.code.to_string(),
                name: s.name.to_string(),
                net_annual: out.net_annual,
                state_tax: out.state_tax.tax,
                total_tax: out.total_tax,
                approximate: false,
                no_tax: matches!(s.model, state::Model::None),
            }
        })
        .collect();
    entries.sort_by(|a, b| b.net_annual.partial_cmp(&a.net_annual).unwrap());
    entries
}

/// Sweep the traditional 401(k) contribution percentage from 0 to
/// `max_percent` and report take-home, retirement dollars captured (employee +
/// employer match), and total wealth at each step. Powers the contribution
/// optimizer chart.
pub fn k401_curve(base: &CalculationInput, max_percent: f64) -> Vec<K401Point> {
    let mut input = base.clone();
    let max = if max_percent > 0.0 {
        max_percent.min(100.0)
    } else {
        50.0
    };
    let steps = (max as usize).max(1);
    let mut curve = Vec::with_capacity(steps + 1);
    for i in 0..=steps {
        let percent = max * i as f64 / steps as f64;
        input.pretax.k401_percent = percent;
        let out = calculate(&input);
        let employee = out
            .pretax_deductions
            .first()
            .map(|l| l.annual)
            .unwrap_or(0.0);
        let retirement = employee + out.employer.retirement_match;
        curve.push(K401Point {
            percent,
            net_annual: out.net_annual,
            employee_contribution: employee,
            employer_match: out.employer.retirement_match,
            retirement_total: retirement,
            total_wealth: out.net_annual + retirement,
            total_tax: out.total_tax,
        });
    }
    curve
}

/// Marriage bonus/penalty sweep: compare your scenario (filed single) plus a
/// hypothetical partner earning a plain salary (filed single) against the two
/// of you filing jointly. Your deductions/credits carry into the joint return;
/// the partner brings only wages — a deliberate simplification.
pub fn marriage_sweep(
    base: &CalculationInput,
    points: usize,
    max_partner_income: f64,
) -> Vec<MarriagePoint> {
    let n = points.clamp(2, 200);
    let max = if max_partner_income > 0.0 {
        max_partner_income
    } else {
        250_000.0
    };

    // You, filing single.
    let mut you = base.clone();
    you.filing_status = FilingStatus::Single;
    let tax_you = calculate(&you).total_tax;

    let partner_source = |income: f64| IncomeSource {
        label: "Partner".into(),
        kind: IncomeKind::Salary,
        amount: income,
        frequency: PayFrequency::Annually,
        hours_per_week: 40.0,
        weeks_per_year: 52.0,
        overtime_hours_per_week: 0.0,
        overtime_multiplier: 1.5,
    };

    // Partner alone, filing single: plain salary, same state/year, no extras.
    let mut partner = CalculationInput {
        tax_year: base.tax_year,
        incomes: vec![],
        filing_status: FilingStatus::Single,
        state: base.state.clone(),
        dependents_under_17: 0,
        other_dependents: 0,
        itemized_deductions: 0.0,
        age_50_plus: false,
        pretax: Default::default(),
        posttax: Default::default(),
        capital_gains: Default::default(),
    };

    // Married filing jointly: your full scenario + partner's wages.
    let mut married = base.clone();
    married.filing_status = FilingStatus::MarriedJoint;

    (0..n)
        .map(|i| {
            let income = max * i as f64 / (n - 1) as f64;
            partner.incomes = vec![partner_source(income)];
            let tax_partner = if income > 0.0 {
                calculate(&partner).total_tax
            } else {
                0.0
            };
            married.incomes = base.incomes.clone();
            married.incomes.push(partner_source(income));
            let tax_married = calculate(&married).total_tax;
            let single_combined = tax_you + tax_partner;
            MarriagePoint {
                partner_income: income,
                tax_single_combined: single_combined,
                tax_married,
                bonus: single_combined - tax_married,
            }
        })
        .collect()
}

/// Roth vs Traditional with equal out-of-pocket cost: the traditional account
/// receives `annual_contribution` pre-tax dollars; the Roth receives the same
/// after-tax outlay, `annual_contribution × (1 − current rate)`. Traditional
/// withdrawals are taxed at the retirement rate; Roth withdrawals are free.
pub fn roth_vs_traditional(input: &RothTradInput) -> RothTradOutput {
    let r = input.annual_return_percent / 100.0;
    let growth = input.contribution_growth_percent / 100.0;
    let now_rate = (input.current_marginal_rate_percent / 100.0).clamp(0.0, 0.99);
    let ret_rate = (input.retirement_tax_rate_percent / 100.0).clamp(0.0, 0.99);
    let n_years = input.years.clamp(1, 100);

    let mut trad_balance = 0.0f64;
    let mut roth_balance = 0.0f64;
    let mut contribution = input.annual_contribution.max(0.0);
    let mut years = Vec::with_capacity(n_years as usize);

    for year in 1..=n_years {
        let roth_contribution = contribution * (1.0 - now_rate);
        // Mid-year contribution growth, same convention as project().
        trad_balance += trad_balance * r + contribution * (1.0 + r / 2.0);
        roth_balance += roth_balance * r + roth_contribution * (1.0 + r / 2.0);
        years.push(RothTradYear {
            year,
            traditional_after_tax: trad_balance * (1.0 - ret_rate),
            roth_after_tax: roth_balance,
        });
        contribution *= 1.0 + growth;
    }

    let final_traditional = trad_balance * (1.0 - ret_rate);
    let final_roth = roth_balance;
    RothTradOutput {
        years,
        final_traditional,
        final_roth,
        traditional_advantage: final_traditional - final_roth,
        breakeven_retirement_rate_percent: now_rate * 100.0,
    }
}

// ---- Projection ----

/// Deterministic xorshift64* PRNG so WASM/API results are reproducible.
struct Rng(u64);

impl Rng {
    fn next_u64(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        x.wrapping_mul(0x2545F4914F6CDD1D)
    }

    fn uniform(&mut self) -> f64 {
        // (0, 1] to keep ln() finite in Box-Muller.
        ((self.next_u64() >> 11) as f64 + 1.0) / (1u64 << 53) as f64
    }

    /// Standard normal via Box-Muller.
    fn normal(&mut self) -> f64 {
        let u1 = self.uniform();
        let u2 = self.uniform();
        (-2.0 * u1.ln()).sqrt() * (std::f64::consts::TAU * u2).cos()
    }
}

const MC_TRIALS: usize = 500;
const MC_SEED: u64 = 0x9E37_79B9_7F4A_7C15;

/// Compound-growth savings projection with contribution growth, inflation,
/// and (when volatility > 0) Monte Carlo percentile bands.
pub fn project(input: &ProjectionInput) -> ProjectionOutput {
    let r = input.annual_return_percent / 100.0;
    let infl = input.inflation_percent / 100.0;
    let growth = input.contribution_growth_percent / 100.0;
    let vol = (input.return_volatility_percent / 100.0).max(0.0);
    let n_years = input.years.min(100) as usize;

    // Deterministic expected path.
    let mut balance = input.current_balance.max(0.0);
    let mut contribution = input.annual_contribution.max(0.0);
    let mut total_contributed = 0.0;
    let mut total_interest = 0.0;
    let mut years: Vec<ProjectionYear> = Vec::with_capacity(n_years);
    let mut target_year_reached = None;

    for year in 1..=n_years as u32 {
        let interest = balance * r + contribution * r / 2.0; // contributions mid-year on average
        balance += contribution + interest;
        total_contributed += contribution;
        total_interest += interest;
        let real_balance = balance / (1.0 + infl).powi(year as i32);
        if target_year_reached.is_none()
            && input.target_balance > 0.0
            && balance >= input.target_balance
        {
            target_year_reached = Some(year);
        }
        years.push(ProjectionYear {
            year,
            contribution,
            interest_earned: interest,
            balance,
            real_balance,
            p10: 0.0,
            p90: 0.0,
        });
        contribution *= 1.0 + growth;
    }

    // Monte Carlo bands.
    let mut target_probability = 0.0;
    if vol > 0.0 && n_years > 0 {
        let mut rng = Rng(MC_SEED);
        // per_year[y][trial]
        let mut per_year = vec![vec![0.0f64; MC_TRIALS]; n_years];
        let mut hit_target = 0usize;
        for trial in 0..MC_TRIALS {
            let mut b = input.current_balance.max(0.0);
            let mut c = input.annual_contribution.max(0.0);
            for year_balances in per_year.iter_mut() {
                let yr_return = r + vol * rng.normal();
                let interest = b * yr_return + c * yr_return / 2.0;
                b = (b + c + interest).max(0.0);
                year_balances[trial] = b;
                c *= 1.0 + growth;
            }
            if input.target_balance > 0.0 && b >= input.target_balance {
                hit_target += 1;
            }
        }
        for (y, year_balances) in per_year.iter_mut().enumerate() {
            year_balances.sort_by(|a, b| a.partial_cmp(b).unwrap());
            years[y].p10 = year_balances[MC_TRIALS / 10];
            years[y].p90 = year_balances[MC_TRIALS - 1 - MC_TRIALS / 10];
        }
        if input.target_balance > 0.0 {
            target_probability = hit_target as f64 / MC_TRIALS as f64;
        }
    }

    ProjectionOutput {
        final_balance: balance,
        final_real_balance: years.last().map(|y| y.real_balance).unwrap_or(balance),
        total_contributed,
        total_interest,
        years,
        target_year_reached,
        target_probability,
    }
}
