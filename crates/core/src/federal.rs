//! US federal income tax data and math, tax years 2024-2026.
//!
//! 2025 and 2026 figures reflect the One Big Beautiful Bill Act (OBBBA, July
//! 2025): higher standard deductions, a $2,200 child tax credit, and the
//! temporary tips / overtime-premium deductions.

use crate::types::{BracketSlice, FilingStatus};

pub const DEFAULT_TAX_YEAR: u16 = 2025;

/// (upper bound, rate). Final bracket is unbounded.
pub type Bracket = (f64, f64);

pub struct TaxYearData {
    pub year: u16,
    pub single: &'static [Bracket],
    pub married_joint: &'static [Bracket],
    pub married_separate: &'static [Bracket],
    pub head_of_household: &'static [Bracket],
    /// Standard deduction by status: [single, mfj, mfs, hoh]
    pub std_deduction: [f64; 4],
    /// LTCG 0%/15% upper bounds by status: [(single0, single15), (mfj...), (mfs...), (hoh...)]
    pub ltcg: [(f64, f64); 4],
    pub ss_wage_base: f64,
    pub k401_limit: f64,
    pub k401_catchup: f64,
    pub ira_limit: f64,
    pub ira_catchup: f64,
    pub hsa_limit_family: f64,
    pub fsa_limit: f64,
    pub ctc_per_child: f64,
    /// OBBBA "no tax on tips / overtime" deductions apply (2025-2028).
    pub obbba_deductions: bool,
}

const Y2024: TaxYearData = TaxYearData {
    year: 2024,
    single: &[
        (11_600.0, 0.10),
        (47_150.0, 0.12),
        (100_525.0, 0.22),
        (191_950.0, 0.24),
        (243_725.0, 0.32),
        (609_350.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    married_joint: &[
        (23_200.0, 0.10),
        (94_300.0, 0.12),
        (201_050.0, 0.22),
        (383_900.0, 0.24),
        (487_450.0, 0.32),
        (731_200.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    married_separate: &[
        (11_600.0, 0.10),
        (47_150.0, 0.12),
        (100_525.0, 0.22),
        (191_950.0, 0.24),
        (243_725.0, 0.32),
        (365_600.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    head_of_household: &[
        (16_550.0, 0.10),
        (63_100.0, 0.12),
        (100_500.0, 0.22),
        (191_950.0, 0.24),
        (243_700.0, 0.32),
        (609_350.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    std_deduction: [14_600.0, 29_200.0, 14_600.0, 21_900.0],
    ltcg: [
        (47_025.0, 518_900.0),
        (94_050.0, 583_750.0),
        (47_025.0, 291_850.0),
        (63_000.0, 551_350.0),
    ],
    ss_wage_base: 168_600.0,
    k401_limit: 23_000.0,
    k401_catchup: 7_500.0,
    ira_limit: 7_000.0,
    ira_catchup: 1_000.0,
    hsa_limit_family: 8_300.0,
    fsa_limit: 3_200.0,
    ctc_per_child: 2_000.0,
    obbba_deductions: false,
};

const Y2025: TaxYearData = TaxYearData {
    year: 2025,
    single: &[
        (11_925.0, 0.10),
        (48_475.0, 0.12),
        (103_350.0, 0.22),
        (197_300.0, 0.24),
        (250_525.0, 0.32),
        (626_350.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    married_joint: &[
        (23_850.0, 0.10),
        (96_950.0, 0.12),
        (206_700.0, 0.22),
        (394_600.0, 0.24),
        (501_050.0, 0.32),
        (751_600.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    married_separate: &[
        (11_925.0, 0.10),
        (48_475.0, 0.12),
        (103_350.0, 0.22),
        (197_300.0, 0.24),
        (250_525.0, 0.32),
        (375_800.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    head_of_household: &[
        (17_000.0, 0.10),
        (64_850.0, 0.12),
        (103_350.0, 0.22),
        (197_300.0, 0.24),
        (250_525.0, 0.32),
        (626_350.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    // OBBBA-increased 2025 standard deductions.
    std_deduction: [15_750.0, 31_500.0, 15_750.0, 23_625.0],
    ltcg: [
        (48_350.0, 533_400.0),
        (96_700.0, 600_050.0),
        (48_350.0, 300_000.0),
        (64_750.0, 566_700.0),
    ],
    ss_wage_base: 176_100.0,
    k401_limit: 23_500.0,
    k401_catchup: 7_500.0,
    ira_limit: 7_000.0,
    ira_catchup: 1_000.0,
    hsa_limit_family: 8_550.0,
    fsa_limit: 3_300.0,
    ctc_per_child: 2_200.0,
    obbba_deductions: true,
};

const Y2026: TaxYearData = TaxYearData {
    year: 2026,
    single: &[
        (12_400.0, 0.10),
        (50_400.0, 0.12),
        (105_700.0, 0.22),
        (201_775.0, 0.24),
        (256_225.0, 0.32),
        (640_600.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    married_joint: &[
        (24_800.0, 0.10),
        (100_800.0, 0.12),
        (211_400.0, 0.22),
        (403_550.0, 0.24),
        (512_450.0, 0.32),
        (768_700.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    married_separate: &[
        (12_400.0, 0.10),
        (50_400.0, 0.12),
        (105_700.0, 0.22),
        (201_775.0, 0.24),
        (256_225.0, 0.32),
        (384_350.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    head_of_household: &[
        (17_700.0, 0.10),
        (67_450.0, 0.12),
        (105_700.0, 0.22),
        (201_775.0, 0.24),
        (256_225.0, 0.32),
        (640_600.0, 0.35),
        (f64::INFINITY, 0.37),
    ],
    std_deduction: [16_100.0, 32_200.0, 16_100.0, 24_150.0],
    ltcg: [
        (49_450.0, 545_500.0),
        (98_900.0, 613_700.0),
        (49_450.0, 306_850.0),
        (66_200.0, 579_600.0),
    ],
    ss_wage_base: 184_500.0,
    k401_limit: 24_500.0,
    k401_catchup: 8_000.0,
    ira_limit: 7_500.0,
    ira_catchup: 1_100.0,
    hsa_limit_family: 8_750.0,
    fsa_limit: 3_400.0,
    ctc_per_child: 2_200.0,
    obbba_deductions: true,
};

pub fn supported_years() -> [u16; 3] {
    [2024, 2025, 2026]
}

/// Data for a tax year; unknown years fall back to the default year.
pub fn for_year(year: u16) -> &'static TaxYearData {
    match year {
        2024 => &Y2024,
        2026 => &Y2026,
        _ => &Y2025,
    }
}

fn status_index(status: FilingStatus) -> usize {
    match status {
        FilingStatus::Single => 0,
        FilingStatus::MarriedJoint => 1,
        FilingStatus::MarriedSeparate => 2,
        FilingStatus::HeadOfHousehold => 3,
    }
}

pub fn ordinary_brackets(data: &'static TaxYearData, status: FilingStatus) -> &'static [Bracket] {
    match status {
        FilingStatus::Single => data.single,
        FilingStatus::MarriedJoint => data.married_joint,
        FilingStatus::MarriedSeparate => data.married_separate,
        FilingStatus::HeadOfHousehold => data.head_of_household,
    }
}

pub fn standard_deduction(data: &TaxYearData, status: FilingStatus) -> f64 {
    data.std_deduction[status_index(status)]
}

pub fn ltcg_brackets(data: &TaxYearData, status: FilingStatus) -> [Bracket; 3] {
    let (b0, b15) = data.ltcg[status_index(status)];
    [(b0, 0.0), (b15, 0.15), (f64::INFINITY, 0.20)]
}

/// Net investment income tax (3.8%) MAGI threshold (statutory, not indexed).
pub fn niit_threshold(status: FilingStatus) -> f64 {
    match status {
        FilingStatus::MarriedJoint => 250_000.0,
        FilingStatus::MarriedSeparate => 125_000.0,
        _ => 200_000.0,
    }
}

pub const NIIT_RATE: f64 = 0.038;
pub const ODC_PER_DEPENDENT: f64 = 500.0;

/// Child tax credit phase-out threshold (AGI).
pub fn ctc_phaseout_threshold(status: FilingStatus) -> f64 {
    match status {
        FilingStatus::MarriedJoint => 400_000.0,
        _ => 200_000.0,
    }
}

/// Progressive tax over `taxable`, returning total and per-bracket slices.
pub fn progressive_tax(taxable: f64, brackets: &[Bracket]) -> (f64, Vec<BracketSlice>) {
    let mut total = 0.0;
    let mut slices = Vec::new();
    let mut lower = 0.0;
    for &(upper, rate) in brackets {
        if taxable <= lower {
            break;
        }
        let in_bracket = (taxable.min(upper)) - lower;
        let tax = in_bracket * rate;
        total += tax;
        slices.push(BracketSlice {
            rate,
            lower,
            upper: if upper.is_finite() { Some(upper) } else { None },
            income_in_bracket: in_bracket,
            tax_in_bracket: tax,
        });
        lower = upper;
    }
    (total, slices)
}

/// Marginal rate at a given taxable income.
pub fn marginal_rate(taxable: f64, brackets: &[Bracket]) -> f64 {
    for &(upper, rate) in brackets {
        if taxable <= upper {
            return rate;
        }
    }
    brackets.last().map(|b| b.1).unwrap_or(0.0)
}

/// Long-term gains tax with proper "stacking" on top of ordinary taxable income.
pub fn ltcg_tax(data: &TaxYearData, ordinary_taxable: f64, ltcg: f64, status: FilingStatus) -> f64 {
    if ltcg <= 0.0 {
        return 0.0;
    }
    let brackets = ltcg_brackets(data, status);
    let mut tax = 0.0;
    let start = ordinary_taxable.max(0.0);
    let end = start + ltcg;
    let mut lower = 0.0f64;
    for (upper, rate) in brackets {
        let seg_lo = start.max(lower);
        let seg_hi = end.min(upper);
        if seg_hi > seg_lo {
            tax += (seg_hi - seg_lo) * rate;
        }
        lower = upper;
    }
    tax
}

/// Child tax credit + credit for other dependents, with AGI phase-out
/// ($50 reduction per $1,000 over the threshold).
pub fn dependent_credits(
    data: &TaxYearData,
    agi: f64,
    children_under_17: u32,
    other_dependents: u32,
    status: FilingStatus,
) -> (f64, f64) {
    let base_ctc = children_under_17 as f64 * data.ctc_per_child;
    let base_odc = other_dependents as f64 * ODC_PER_DEPENDENT;
    let threshold = ctc_phaseout_threshold(status);
    let over = (agi - threshold).max(0.0);
    let reduction = (over / 1_000.0).ceil() * 50.0;
    let total_base = base_ctc + base_odc;
    let total_after = (total_base - reduction).max(0.0);
    if total_base <= 0.0 {
        return (0.0, 0.0);
    }
    // Apportion the phase-out between the two credits.
    let scale = total_after / total_base;
    (base_ctc * scale, base_odc * scale)
}

/// OBBBA (2025-2028) deductions for tip income and overtime premium pay.
/// Both phase out at 10% of MAGI over $150k ($300k MFJ). Returns
/// (tips_deduction, overtime_deduction).
pub fn obbba_deductions(
    data: &TaxYearData,
    tips_income: f64,
    overtime_premium: f64,
    magi: f64,
    status: FilingStatus,
) -> (f64, f64) {
    if !data.obbba_deductions {
        return (0.0, 0.0);
    }
    let joint = matches!(status, FilingStatus::MarriedJoint);
    let threshold = if joint { 300_000.0 } else { 150_000.0 };
    let phaseout = (magi - threshold).max(0.0) * 0.10;

    let tips_cap = 25_000.0;
    let ot_cap = if joint { 25_000.0 } else { 12_500.0 };

    let tips_ded = (tips_income.min(tips_cap) - phaseout).max(0.0);
    let ot_ded = (overtime_premium.min(ot_cap) - phaseout).max(0.0);
    (tips_ded, ot_ded)
}
