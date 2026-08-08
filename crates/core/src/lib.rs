//! income-calc-core: pure income / US tax calculation engine (tax years 2024-2026).
//!
//! Shared by the Axum API server and the WebAssembly build used by the
//! Angular frontend. All figures are estimates for planning purposes, not
//! tax advice.

pub mod calc;
pub mod federal;
pub mod fica;
pub mod state;
pub mod types;

pub use calc::{calculate, project, solve_required_gross};
pub use federal::supported_years;
pub use types::*;

use serde::Serialize;

#[derive(Serialize)]
pub struct StateListEntry {
    pub code: &'static str,
    pub name: &'static str,
    pub approximate: bool,
    pub no_tax: bool,
}

/// State list for UI dropdowns.
pub fn state_list() -> Vec<StateListEntry> {
    state::all_states()
        .iter()
        .map(|s| StateListEntry {
            code: s.code,
            name: s.name,
            approximate: matches!(s.model, state::Model::FlatApprox(_)),
            no_tax: matches!(s.model, state::Model::None),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn salary_input(amount: f64) -> CalculationInput {
        CalculationInput {
            tax_year: 2025,
            incomes: vec![IncomeSource {
                label: "Job".into(),
                kind: IncomeKind::Salary,
                amount,
                frequency: PayFrequency::Annually,
                hours_per_week: 40.0,
                weeks_per_year: 52.0,
                overtime_hours_per_week: 0.0,
                overtime_multiplier: 1.5,
            }],
            filing_status: FilingStatus::Single,
            state: "NONE".into(),
            dependents_under_17: 0,
            other_dependents: 0,
            itemized_deductions: 0.0,
            age_50_plus: false,
            pretax: Default::default(),
            posttax: Default::default(),
            capital_gains: Default::default(),
        }
    }

    #[test]
    fn single_100k_federal_tax_2025() {
        let out = calculate(&salary_input(100_000.0));
        // taxable = 100k - 15,750 (OBBBA std deduction) = 84,250
        assert!((out.federal_taxable_income - 84_250.0).abs() < 0.01);
        // 10%*11925 + 12%*(48475-11925) + 22%*(84250-48475) = 13,449
        assert!(
            (out.federal_tax - 13_449.0).abs() < 1.0,
            "got {}",
            out.federal_tax
        );
        // FICA: 6.2% + 1.45% of 100k = 7650
        assert!((out.fica.total - 7_650.0).abs() < 0.01);
        assert!((out.net_annual - (100_000.0 - 13_449.0 - 7_650.0)).abs() < 1.0);
        assert!((out.rates.marginal_federal - 0.22).abs() < 1e-9);
    }

    #[test]
    fn tax_year_2024_uses_2024_data() {
        let mut input = salary_input(100_000.0);
        input.tax_year = 2024;
        let out = calculate(&input);
        assert_eq!(out.tax_year, 2024);
        // taxable = 100k - 14,600 = 85,400
        assert!((out.federal_taxable_income - 85_400.0).abs() < 0.01);
        // 1,160 + 4,266 + 22%*(85,400-47,150) = 13,841
        assert!(
            (out.federal_tax - 13_841.0).abs() < 1.0,
            "got {}",
            out.federal_tax
        );
    }

    #[test]
    fn tax_year_2026_uses_2026_data() {
        let mut input = salary_input(100_000.0);
        input.tax_year = 2026;
        let out = calculate(&input);
        assert_eq!(out.tax_year, 2026);
        assert!((out.standard_deduction - 16_100.0).abs() < 0.01);
    }

    #[test]
    fn unknown_year_falls_back_to_default() {
        let mut input = salary_input(100_000.0);
        input.tax_year = 1999;
        let out = calculate(&input);
        assert_eq!(out.tax_year, 2025);
    }

    #[test]
    fn hourly_with_overtime() {
        let mut input = salary_input(0.0);
        input.incomes = vec![IncomeSource {
            label: "Hourly job".into(),
            kind: IncomeKind::Hourly,
            amount: 25.0,
            frequency: PayFrequency::Hourly,
            hours_per_week: 40.0,
            weeks_per_year: 50.0,
            overtime_hours_per_week: 5.0,
            overtime_multiplier: 1.5,
        }];
        let out = calculate(&input);
        // base 25*40*50 = 50000, OT 25*1.5*5*50 = 9375
        assert!((out.gross.total_annual - 59_375.0).abs() < 0.01);
        // OBBBA overtime deduction on the premium half: 25*0.5*5*50 = 3,125
        assert!(
            (out.overtime_deduction - 3_125.0).abs() < 0.01,
            "got {}",
            out.overtime_deduction
        );
    }

    #[test]
    fn overtime_deduction_absent_in_2024() {
        let mut input = salary_input(0.0);
        input.tax_year = 2024;
        input.incomes = vec![IncomeSource {
            label: "Hourly job".into(),
            kind: IncomeKind::Hourly,
            amount: 25.0,
            frequency: PayFrequency::Hourly,
            hours_per_week: 40.0,
            weeks_per_year: 50.0,
            overtime_hours_per_week: 5.0,
            overtime_multiplier: 1.5,
        }];
        let out = calculate(&input);
        assert_eq!(out.overtime_deduction, 0.0);
    }

    #[test]
    fn tips_deduction_capped_at_25k() {
        let mut input = salary_input(0.0);
        input.incomes = vec![IncomeSource {
            label: "Tips".into(),
            kind: IncomeKind::Tips,
            amount: 30_000.0,
            frequency: PayFrequency::Annually,
            hours_per_week: 40.0,
            weeks_per_year: 52.0,
            overtime_hours_per_week: 0.0,
            overtime_multiplier: 1.5,
        }];
        let out = calculate(&input);
        assert!((out.tips_deduction - 25_000.0).abs() < 0.01);
        // 30k - 15,750 std - 25k tips deduction => no federal income tax
        assert!(out.federal_tax < 0.01, "got {}", out.federal_tax);
        // FICA still due on tip wages
        assert!(out.fica.total > 2_000.0);
    }

    #[test]
    fn ss_wage_base_cap() {
        let out = calculate(&salary_input(300_000.0));
        assert!((out.fica.social_security - 176_100.0 * 0.062).abs() < 0.01);
        // Additional medicare over 200k: 0.9% * 100k = 900
        assert!((out.fica.additional_medicare - 900.0).abs() < 0.01);
    }

    #[test]
    fn pretax_401k_reduces_income_tax_not_fica() {
        let mut input = salary_input(100_000.0);
        input.pretax.k401_percent = 10.0;
        let out = calculate(&input);
        assert!((out.pretax_total - 10_000.0).abs() < 0.01);
        assert!((out.federal_taxable_income - 74_250.0).abs() < 0.01);
        // FICA still on full 100k
        assert!((out.fica.total - 7_650.0).abs() < 0.01);
    }

    #[test]
    fn k401_limit_clamped() {
        let mut input = salary_input(200_000.0);
        input.pretax.k401_percent = 50.0; // would be 100k
        let out = calculate(&input);
        let k401_line = &out.pretax_deductions[0];
        assert!((k401_line.annual - 23_500.0).abs() < 0.01);
        assert!(!out.warnings.is_empty());
    }

    #[test]
    fn self_employment_tax_applied() {
        let mut input = salary_input(0.0);
        input.incomes = vec![IncomeSource {
            label: "Freelance".into(),
            kind: IncomeKind::SelfEmployment,
            amount: 80_000.0,
            frequency: PayFrequency::Annually,
            hours_per_week: 40.0,
            weeks_per_year: 52.0,
            overtime_hours_per_week: 0.0,
            overtime_multiplier: 1.5,
        }];
        let out = calculate(&input);
        let se_base = 80_000.0 * 0.9235;
        let expected = se_base * 0.153;
        assert!((out.self_employment_tax - expected).abs() < 1.0);
        assert!(out.fica.total < 0.01); // no W-2 FICA
    }

    #[test]
    fn child_tax_credit_2025_is_2200() {
        let mut input = salary_input(100_000.0);
        input.dependents_under_17 = 2;
        let out = calculate(&input);
        assert!((out.child_tax_credit - 4_400.0).abs() < 0.01);
    }

    #[test]
    fn state_flat_tax() {
        let mut input = salary_input(100_000.0);
        input.state = "IL".into();
        let out = calculate(&input);
        // 4.95% of 84,250 federal taxable
        assert!((out.state_tax.tax - 84_250.0 * 0.0495).abs() < 0.01);
        assert!(!out.state_tax.approximate);
    }

    #[test]
    fn california_brackets() {
        let mut input = salary_input(100_000.0);
        input.state = "CA".into();
        let out = calculate(&input);
        assert!(
            out.state_tax.tax > 4_000.0 && out.state_tax.tax < 8_000.0,
            "got {}",
            out.state_tax.tax
        );
        assert!(!out.state_tax.approximate);
    }

    #[test]
    fn no_tax_state() {
        let mut input = salary_input(100_000.0);
        input.state = "TX".into();
        let out = calculate(&input);
        assert_eq!(out.state_tax.tax, 0.0);
    }

    #[test]
    fn ltcg_stacking() {
        let mut input = salary_input(50_000.0);
        input.capital_gains.long_term = 20_000.0;
        let out = calculate(&input);
        // Ordinary taxable = 34,250; gains stack to 54,250; 0% bracket ends at 48,350.
        // 0% on 14,100; 15% on 5,900 = 885
        assert!(
            (out.capital_gains_tax - 885.0).abs() < 1.0,
            "got {}",
            out.capital_gains_tax
        );
    }

    #[test]
    fn solver_hits_target_net() {
        let input = salary_input(0.0);
        let result = solve_required_gross(&input, 80_000.0);
        assert!(
            (result.achieved_net_annual - 80_000.0).abs() < 5.0,
            "achieved {}",
            result.achieved_net_annual
        );
        assert!(result.required_amount > 80_000.0); // gross must exceed net
    }

    #[test]
    fn solver_with_deductions_scales() {
        let mut input = salary_input(0.0);
        input.pretax.k401_percent = 10.0;
        input.state = "CA".into();
        let result = solve_required_gross(&input, 60_000.0);
        assert!((result.achieved_net_annual - 60_000.0).abs() < 5.0);
    }

    #[test]
    fn unclaimed_match_insight() {
        let mut input = salary_input(100_000.0);
        input.pretax.employer_match_percent = 100.0;
        input.pretax.employer_match_limit_percent = 4.0;
        // No employee contribution => the whole 4% match is unclaimed.
        let out = calculate(&input);
        let insight = out
            .insights
            .iter()
            .find(|i| i.title.contains("match"))
            .expect("match insight missing");
        assert!((insight.annual_value - 4_000.0).abs() < 1.0);
    }

    #[test]
    fn projection_compounds() {
        let out = project(&ProjectionInput {
            current_balance: 10_000.0,
            annual_contribution: 12_000.0,
            annual_return_percent: 7.0,
            inflation_percent: 3.0,
            contribution_growth_percent: 2.0,
            years: 30,
            return_volatility_percent: 0.0,
            target_balance: 0.0,
        });
        assert_eq!(out.years.len(), 30);
        assert!(out.final_balance > out.total_contributed + 10_000.0);
        assert!(out.final_real_balance < out.final_balance);
    }

    #[test]
    fn monte_carlo_bands_and_target() {
        let input = ProjectionInput {
            current_balance: 10_000.0,
            annual_contribution: 12_000.0,
            annual_return_percent: 7.0,
            inflation_percent: 3.0,
            contribution_growth_percent: 2.0,
            years: 30,
            return_volatility_percent: 15.0,
            target_balance: 200_000.0,
        };
        let out = project(&input);
        let last = out.years.last().unwrap();
        assert!(last.p10 > 0.0);
        assert!(last.p10 < last.p90, "p10 {} p90 {}", last.p10, last.p90);
        assert!(last.p10 < last.balance && last.balance < last.p90);
        // A modest target over 30 years should be highly likely.
        assert!(out.target_probability > 0.9, "p={}", out.target_probability);
        assert!(out.target_year_reached.is_some());
        // Deterministic: same input, same bands.
        let again = project(&input);
        assert_eq!(
            out.years.last().unwrap().p10,
            again.years.last().unwrap().p10
        );
    }

    #[test]
    fn state_list_complete() {
        let list = state_list();
        assert_eq!(list.len(), 52); // 50 states + DC + NONE
    }

    #[test]
    fn json_roundtrip_and_defaults() {
        let input = salary_input(75_000.0);
        let json = serde_json::to_string(&input).unwrap();
        let back: CalculationInput = serde_json::from_str(&json).unwrap();
        let out = calculate(&back);
        assert!(out.net_annual > 0.0);
        serde_json::to_string(&out).unwrap();
        // Older payloads without tax_year still parse (defaults to 2025).
        let legacy: CalculationInput = serde_json::from_str("{}").unwrap();
        assert_eq!(legacy.tax_year, 2025);
    }
}
