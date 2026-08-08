//! FICA (Social Security + Medicare) and self-employment tax.
//! The Social Security wage base is year-indexed and passed in from
//! `federal::TaxYearData`; Medicare thresholds are statutory (not indexed).

use crate::types::{FicaBreakdown, FilingStatus};

pub const SS_RATE: f64 = 0.062;
pub const MEDICARE_RATE: f64 = 0.0145;
pub const ADDITIONAL_MEDICARE_RATE: f64 = 0.009;
pub const SE_TAX_BASE_FACTOR: f64 = 0.9235;
pub const FUTA_RATE: f64 = 0.006;
pub const FUTA_WAGE_BASE: f64 = 7_000.0;

pub fn additional_medicare_threshold(status: FilingStatus) -> f64 {
    match status {
        FilingStatus::MarriedJoint => 250_000.0,
        FilingStatus::MarriedSeparate => 125_000.0,
        _ => 200_000.0,
    }
}

/// Employee-side FICA on W-2 wages.
pub fn employee_fica(wages: f64, status: FilingStatus, ss_wage_base: f64) -> FicaBreakdown {
    let ss = wages.clamp(0.0, ss_wage_base) * SS_RATE;
    let medicare = wages.max(0.0) * MEDICARE_RATE;
    let threshold = additional_medicare_threshold(status);
    let additional = (wages - threshold).max(0.0) * ADDITIONAL_MEDICARE_RATE;
    FicaBreakdown {
        social_security: ss,
        medicare,
        additional_medicare: additional,
        total: ss + medicare + additional,
    }
}

/// Employer-side FICA + FUTA on W-2 wages.
pub fn employer_fica(wages: f64, ss_wage_base: f64) -> (f64, f64, f64) {
    let ss = wages.clamp(0.0, ss_wage_base) * SS_RATE;
    let medicare = wages.max(0.0) * MEDICARE_RATE;
    let futa = wages.clamp(0.0, FUTA_WAGE_BASE) * FUTA_RATE;
    (ss, medicare, futa)
}

/// Self-employment tax. Social Security portion respects the shared wage base
/// (W-2 wages consume the base first). Returns (se_tax, half_se_deduction).
pub fn self_employment_tax(net_se_income: f64, w2_wages: f64, ss_wage_base: f64) -> (f64, f64) {
    if net_se_income <= 0.0 {
        return (0.0, 0.0);
    }
    let se_base = net_se_income * SE_TAX_BASE_FACTOR;
    let ss_room = (ss_wage_base - w2_wages.max(0.0)).max(0.0);
    let ss_taxable = se_base.min(ss_room);
    let ss_tax = ss_taxable * SS_RATE * 2.0;
    let medicare_tax = se_base * MEDICARE_RATE * 2.0;
    let se_tax = ss_tax + medicare_tax;
    (se_tax, se_tax / 2.0)
}
