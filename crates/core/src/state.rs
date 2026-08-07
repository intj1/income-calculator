//! State income tax, tax year 2025.
//!
//! Fidelity levels:
//! - No-income-tax states: exact.
//! - Flat-tax states: exact statutory rate.
//! - CA and NY: real progressive brackets + state standard deduction.
//! - Remaining progressive states: flat approximation of a typical effective
//!   rate, flagged `approximate: true` so the UI can disclose it.

use crate::federal::progressive_tax;
use crate::types::{FilingStatus, StateTaxResult};

pub type Bracket = (f64, f64);

pub enum Model {
    None,
    Flat(f64),
    FlatApprox(f64),
    Brackets {
        single: &'static [Bracket],
        joint: &'static [Bracket],
        std_single: f64,
        std_joint: f64,
    },
}

pub struct StateInfo {
    pub code: &'static str,
    pub name: &'static str,
    pub model: Model,
}

const CA_SINGLE: &[Bracket] = &[
    (10_756.0, 0.01),
    (25_499.0, 0.02),
    (40_245.0, 0.04),
    (55_866.0, 0.06),
    (70_606.0, 0.08),
    (360_659.0, 0.093),
    (432_787.0, 0.103),
    (721_314.0, 0.113),
    (f64::INFINITY, 0.123),
];
const CA_JOINT: &[Bracket] = &[
    (21_512.0, 0.01),
    (50_998.0, 0.02),
    (80_490.0, 0.04),
    (111_732.0, 0.06),
    (141_212.0, 0.08),
    (721_318.0, 0.093),
    (865_574.0, 0.103),
    (1_442_628.0, 0.113),
    (f64::INFINITY, 0.123),
];
const NY_SINGLE: &[Bracket] = &[
    (8_500.0, 0.04),
    (11_700.0, 0.045),
    (13_900.0, 0.0525),
    (80_650.0, 0.055),
    (215_400.0, 0.06),
    (1_077_550.0, 0.0685),
    (5_000_000.0, 0.0965),
    (25_000_000.0, 0.103),
    (f64::INFINITY, 0.109),
];
const NY_JOINT: &[Bracket] = &[
    (17_150.0, 0.04),
    (23_600.0, 0.045),
    (27_900.0, 0.0525),
    (161_550.0, 0.055),
    (323_200.0, 0.06),
    (2_155_350.0, 0.0685),
    (5_000_000.0, 0.0965),
    (25_000_000.0, 0.103),
    (f64::INFINITY, 0.109),
];

pub fn all_states() -> &'static [StateInfo] {
    use Model::*;
    &[
        StateInfo {
            code: "NONE",
            name: "No state / other",
            model: None,
        },
        StateInfo {
            code: "AL",
            name: "Alabama",
            model: FlatApprox(0.05),
        },
        StateInfo {
            code: "AK",
            name: "Alaska",
            model: None,
        },
        StateInfo {
            code: "AZ",
            name: "Arizona",
            model: Flat(0.025),
        },
        StateInfo {
            code: "AR",
            name: "Arkansas",
            model: FlatApprox(0.039),
        },
        StateInfo {
            code: "CA",
            name: "California",
            model: Brackets {
                single: CA_SINGLE,
                joint: CA_JOINT,
                std_single: 5_540.0,
                std_joint: 11_080.0,
            },
        },
        StateInfo {
            code: "CO",
            name: "Colorado",
            model: Flat(0.044),
        },
        StateInfo {
            code: "CT",
            name: "Connecticut",
            model: FlatApprox(0.055),
        },
        StateInfo {
            code: "DE",
            name: "Delaware",
            model: FlatApprox(0.06),
        },
        StateInfo {
            code: "DC",
            name: "District of Columbia",
            model: FlatApprox(0.075),
        },
        StateInfo {
            code: "FL",
            name: "Florida",
            model: None,
        },
        StateInfo {
            code: "GA",
            name: "Georgia",
            model: Flat(0.0539),
        },
        StateInfo {
            code: "HI",
            name: "Hawaii",
            model: FlatApprox(0.079),
        },
        StateInfo {
            code: "ID",
            name: "Idaho",
            model: Flat(0.05695),
        },
        StateInfo {
            code: "IL",
            name: "Illinois",
            model: Flat(0.0495),
        },
        StateInfo {
            code: "IN",
            name: "Indiana",
            model: Flat(0.03),
        },
        StateInfo {
            code: "IA",
            name: "Iowa",
            model: Flat(0.038),
        },
        StateInfo {
            code: "KS",
            name: "Kansas",
            model: FlatApprox(0.0555),
        },
        StateInfo {
            code: "KY",
            name: "Kentucky",
            model: Flat(0.04),
        },
        StateInfo {
            code: "LA",
            name: "Louisiana",
            model: Flat(0.03),
        },
        StateInfo {
            code: "ME",
            name: "Maine",
            model: FlatApprox(0.0695),
        },
        StateInfo {
            code: "MD",
            name: "Maryland",
            model: FlatApprox(0.0495),
        },
        StateInfo {
            code: "MA",
            name: "Massachusetts",
            model: Flat(0.05),
        },
        StateInfo {
            code: "MI",
            name: "Michigan",
            model: Flat(0.0425),
        },
        StateInfo {
            code: "MN",
            name: "Minnesota",
            model: FlatApprox(0.068),
        },
        StateInfo {
            code: "MS",
            name: "Mississippi",
            model: Flat(0.044),
        },
        StateInfo {
            code: "MO",
            name: "Missouri",
            model: FlatApprox(0.047),
        },
        StateInfo {
            code: "MT",
            name: "Montana",
            model: FlatApprox(0.059),
        },
        StateInfo {
            code: "NE",
            name: "Nebraska",
            model: FlatApprox(0.052),
        },
        StateInfo {
            code: "NV",
            name: "Nevada",
            model: None,
        },
        StateInfo {
            code: "NH",
            name: "New Hampshire",
            model: None,
        },
        StateInfo {
            code: "NJ",
            name: "New Jersey",
            model: FlatApprox(0.055),
        },
        StateInfo {
            code: "NM",
            name: "New Mexico",
            model: FlatApprox(0.049),
        },
        StateInfo {
            code: "NY",
            name: "New York",
            model: Brackets {
                single: NY_SINGLE,
                joint: NY_JOINT,
                std_single: 8_000.0,
                std_joint: 16_050.0,
            },
        },
        StateInfo {
            code: "NC",
            name: "North Carolina",
            model: Flat(0.0425),
        },
        StateInfo {
            code: "ND",
            name: "North Dakota",
            model: FlatApprox(0.0225),
        },
        StateInfo {
            code: "OH",
            name: "Ohio",
            model: FlatApprox(0.033),
        },
        StateInfo {
            code: "OK",
            name: "Oklahoma",
            model: FlatApprox(0.0475),
        },
        StateInfo {
            code: "OR",
            name: "Oregon",
            model: FlatApprox(0.0875),
        },
        StateInfo {
            code: "PA",
            name: "Pennsylvania",
            model: Flat(0.0307),
        },
        StateInfo {
            code: "RI",
            name: "Rhode Island",
            model: FlatApprox(0.0525),
        },
        StateInfo {
            code: "SC",
            name: "South Carolina",
            model: FlatApprox(0.062),
        },
        StateInfo {
            code: "SD",
            name: "South Dakota",
            model: None,
        },
        StateInfo {
            code: "TN",
            name: "Tennessee",
            model: None,
        },
        StateInfo {
            code: "TX",
            name: "Texas",
            model: None,
        },
        StateInfo {
            code: "UT",
            name: "Utah",
            model: Flat(0.0455),
        },
        StateInfo {
            code: "VT",
            name: "Vermont",
            model: FlatApprox(0.066),
        },
        StateInfo {
            code: "VA",
            name: "Virginia",
            model: FlatApprox(0.0575),
        },
        StateInfo {
            code: "WA",
            name: "Washington",
            model: None,
        },
        StateInfo {
            code: "WV",
            name: "West Virginia",
            model: FlatApprox(0.0482),
        },
        StateInfo {
            code: "WI",
            name: "Wisconsin",
            model: FlatApprox(0.053),
        },
        StateInfo {
            code: "WY",
            name: "Wyoming",
            model: None,
        },
    ]
}

pub fn find(code: &str) -> Option<&'static StateInfo> {
    let upper = code.to_ascii_uppercase();
    all_states().iter().find(|s| s.code == upper)
}

/// Compute state income tax.
/// `agi` = adjusted gross income (after pre-tax deductions); the base used for
/// flat/approx states is the federal taxable income as a pragmatic proxy.
pub fn compute(code: &str, agi: f64, federal_taxable: f64, status: FilingStatus) -> StateTaxResult {
    let info = match find(code) {
        Some(i) => i,
        Option::None => {
            return StateTaxResult {
                state: code.to_ascii_uppercase(),
                state_name: "Unknown".into(),
                tax: 0.0,
                approximate: true,
                note: "Unknown state code; no state tax applied.".into(),
            }
        }
    };
    let joint = matches!(status, FilingStatus::MarriedJoint);
    match &info.model {
        Model::None => StateTaxResult {
            state: info.code.into(),
            state_name: info.name.into(),
            tax: 0.0,
            approximate: false,
            note: "No state income tax on wages.".into(),
        },
        Model::Flat(rate) => StateTaxResult {
            state: info.code.into(),
            state_name: info.name.into(),
            tax: (federal_taxable.max(0.0)) * rate,
            approximate: false,
            note: format!("Flat {:.2}% applied to federal taxable income.", rate * 100.0),
        },
        Model::FlatApprox(rate) => StateTaxResult {
            state: info.code.into(),
            state_name: info.name.into(),
            tax: (federal_taxable.max(0.0)) * rate,
            approximate: true,
            note: format!(
                "Approximation: {:.2}% effective rate applied to federal taxable income (state uses progressive brackets).",
                rate * 100.0
            ),
        },
        Model::Brackets { single, joint: joint_b, std_single, std_joint } => {
            let (brackets, std) = if joint { (*joint_b, *std_joint) } else { (*single, *std_single) };
            let taxable = (agi - std).max(0.0);
            let (tax, _) = progressive_tax(taxable, brackets);
            StateTaxResult {
                state: info.code.into(),
                state_name: info.name.into(),
                tax,
                approximate: false,
                note: "State brackets and standard deduction applied; state-specific credits not modeled.".into(),
            }
        }
    }
}

/// Marginal state rate at the current income level.
pub fn marginal_rate(code: &str, agi: f64, status: FilingStatus) -> f64 {
    let info = match find(code) {
        Some(i) => i,
        Option::None => return 0.0,
    };
    let joint = matches!(status, FilingStatus::MarriedJoint);
    match &info.model {
        Model::None => 0.0,
        Model::Flat(r) | Model::FlatApprox(r) => *r,
        Model::Brackets {
            single,
            joint: joint_b,
            std_single,
            std_joint,
        } => {
            let (brackets, std) = if joint {
                (*joint_b, *std_joint)
            } else {
                (*single, *std_single)
            };
            let taxable = (agi - std).max(0.0);
            crate::federal::marginal_rate(taxable, brackets)
        }
    }
}
