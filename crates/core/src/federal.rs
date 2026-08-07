//! US federal income tax, tax year 2025.

use crate::types::{BracketSlice, FilingStatus};

pub const TAX_YEAR: u16 = 2025;

/// (upper bound, rate). Final bracket is unbounded.
pub type Bracket = (f64, f64);

pub fn ordinary_brackets(status: FilingStatus) -> &'static [Bracket] {
    match status {
        FilingStatus::Single => &[
            (11_925.0, 0.10),
            (48_475.0, 0.12),
            (103_350.0, 0.22),
            (197_300.0, 0.24),
            (250_525.0, 0.32),
            (626_350.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
        FilingStatus::MarriedJoint => &[
            (23_850.0, 0.10),
            (96_950.0, 0.12),
            (206_700.0, 0.22),
            (394_600.0, 0.24),
            (501_050.0, 0.32),
            (751_600.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
        FilingStatus::MarriedSeparate => &[
            (11_925.0, 0.10),
            (48_475.0, 0.12),
            (103_350.0, 0.22),
            (197_300.0, 0.24),
            (250_525.0, 0.32),
            (375_800.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
        FilingStatus::HeadOfHousehold => &[
            (17_000.0, 0.10),
            (64_850.0, 0.12),
            (103_350.0, 0.22),
            (197_300.0, 0.24),
            (250_525.0, 0.32),
            (626_350.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
    }
}

pub fn standard_deduction(status: FilingStatus) -> f64 {
    match status {
        FilingStatus::Single | FilingStatus::MarriedSeparate => 15_000.0,
        FilingStatus::MarriedJoint => 30_000.0,
        FilingStatus::HeadOfHousehold => 22_500.0,
    }
}

/// Long-term capital gains brackets: (upper bound of taxable income, rate).
pub fn ltcg_brackets(status: FilingStatus) -> [Bracket; 3] {
    match status {
        FilingStatus::Single => [(48_350.0, 0.0), (533_400.0, 0.15), (f64::INFINITY, 0.20)],
        FilingStatus::MarriedJoint => [(96_700.0, 0.0), (600_050.0, 0.15), (f64::INFINITY, 0.20)],
        FilingStatus::MarriedSeparate => {
            [(48_350.0, 0.0), (300_000.0, 0.15), (f64::INFINITY, 0.20)]
        }
        FilingStatus::HeadOfHousehold => {
            [(64_750.0, 0.0), (566_700.0, 0.15), (f64::INFINITY, 0.20)]
        }
    }
}

/// Net investment income tax (3.8%) MAGI threshold.
pub fn niit_threshold(status: FilingStatus) -> f64 {
    match status {
        FilingStatus::MarriedJoint => 250_000.0,
        FilingStatus::MarriedSeparate => 125_000.0,
        _ => 200_000.0,
    }
}

pub const NIIT_RATE: f64 = 0.038;

/// Child tax credit phase-out threshold (AGI).
pub fn ctc_phaseout_threshold(status: FilingStatus) -> f64 {
    match status {
        FilingStatus::MarriedJoint => 400_000.0,
        _ => 200_000.0,
    }
}

pub const CTC_PER_CHILD: f64 = 2_000.0;
pub const ODC_PER_DEPENDENT: f64 = 500.0;

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
pub fn ltcg_tax(ordinary_taxable: f64, ltcg: f64, status: FilingStatus) -> f64 {
    if ltcg <= 0.0 {
        return 0.0;
    }
    let brackets = ltcg_brackets(status);
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
    agi: f64,
    children_under_17: u32,
    other_dependents: u32,
    status: FilingStatus,
) -> (f64, f64) {
    let base_ctc = children_under_17 as f64 * CTC_PER_CHILD;
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
