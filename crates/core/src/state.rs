//! State income tax, tax year 2025.
//!
//! Fidelity levels:
//! - No-income-tax states: exact.
//! - Flat-tax states: exact statutory rate applied to federal taxable income.
//! - Progressive states: real 2024/2025 brackets and state standard deductions
//!   applied to AGI. Married-filing-separately and head-of-household use the
//!   single schedule where the state distinguishes (a common simplification).
//!
//! Not modeled anywhere: state-specific credits, personal exemptions,
//! retirement-income carve-outs, and local/county income taxes (notably
//! Maryland counties and NYC).

use crate::federal::progressive_tax;
use crate::types::{FilingStatus, StateTaxResult};

pub type Bracket = (f64, f64);

pub enum Model {
    None,
    Flat(f64),
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

const INF: f64 = f64::INFINITY;

const AL_S: &[Bracket] = &[(500.0, 0.02), (3_000.0, 0.04), (INF, 0.05)];
const AL_J: &[Bracket] = &[(1_000.0, 0.02), (6_000.0, 0.04), (INF, 0.05)];

const AR: &[Bracket] = &[(4_500.0, 0.02), (INF, 0.039)];

const CT_S: &[Bracket] = &[
    (10_000.0, 0.02),
    (50_000.0, 0.045),
    (100_000.0, 0.055),
    (200_000.0, 0.06),
    (250_000.0, 0.065),
    (500_000.0, 0.069),
    (INF, 0.0699),
];
const CT_J: &[Bracket] = &[
    (20_000.0, 0.02),
    (100_000.0, 0.045),
    (200_000.0, 0.055),
    (400_000.0, 0.06),
    (500_000.0, 0.065),
    (1_000_000.0, 0.069),
    (INF, 0.0699),
];

const CA_SINGLE: &[Bracket] = &[
    (10_756.0, 0.01),
    (25_499.0, 0.02),
    (40_245.0, 0.04),
    (55_866.0, 0.06),
    (70_606.0, 0.08),
    (360_659.0, 0.093),
    (432_787.0, 0.103),
    (721_314.0, 0.113),
    (INF, 0.123),
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
    (INF, 0.123),
];

const DE: &[Bracket] = &[
    (2_000.0, 0.0),
    (5_000.0, 0.022),
    (10_000.0, 0.039),
    (20_000.0, 0.048),
    (25_000.0, 0.052),
    (60_000.0, 0.0555),
    (INF, 0.066),
];

const DC: &[Bracket] = &[
    (10_000.0, 0.04),
    (40_000.0, 0.06),
    (60_000.0, 0.065),
    (250_000.0, 0.085),
    (500_000.0, 0.0925),
    (1_000_000.0, 0.0975),
    (INF, 0.1075),
];

const HI_S: &[Bracket] = &[
    (2_400.0, 0.014),
    (4_800.0, 0.032),
    (9_600.0, 0.055),
    (14_400.0, 0.064),
    (19_200.0, 0.068),
    (24_000.0, 0.072),
    (36_000.0, 0.076),
    (48_000.0, 0.079),
    (150_000.0, 0.0825),
    (175_000.0, 0.09),
    (200_000.0, 0.10),
    (INF, 0.11),
];
const HI_J: &[Bracket] = &[
    (4_800.0, 0.014),
    (9_600.0, 0.032),
    (19_200.0, 0.055),
    (28_800.0, 0.064),
    (38_400.0, 0.068),
    (48_000.0, 0.072),
    (72_000.0, 0.076),
    (96_000.0, 0.079),
    (300_000.0, 0.0825),
    (350_000.0, 0.09),
    (400_000.0, 0.10),
    (INF, 0.11),
];

const KS_S: &[Bracket] = &[(23_000.0, 0.052), (INF, 0.0558)];
const KS_J: &[Bracket] = &[(46_000.0, 0.052), (INF, 0.0558)];

const ME_S: &[Bracket] = &[(26_050.0, 0.058), (61_600.0, 0.0675), (INF, 0.0715)];
const ME_J: &[Bracket] = &[(52_100.0, 0.058), (123_250.0, 0.0675), (INF, 0.0715)];

const MD_S: &[Bracket] = &[
    (1_000.0, 0.02),
    (2_000.0, 0.03),
    (3_000.0, 0.04),
    (100_000.0, 0.0475),
    (125_000.0, 0.05),
    (150_000.0, 0.0525),
    (250_000.0, 0.055),
    (INF, 0.0575),
];
const MD_J: &[Bracket] = &[
    (1_000.0, 0.02),
    (2_000.0, 0.03),
    (3_000.0, 0.04),
    (150_000.0, 0.0475),
    (175_000.0, 0.05),
    (225_000.0, 0.0525),
    (300_000.0, 0.055),
    (INF, 0.0575),
];

const MN_S: &[Bracket] = &[
    (31_690.0, 0.0535),
    (104_090.0, 0.068),
    (193_240.0, 0.0785),
    (INF, 0.0985),
];
const MN_J: &[Bracket] = &[
    (46_330.0, 0.0535),
    (184_040.0, 0.068),
    (321_450.0, 0.0785),
    (INF, 0.0985),
];

const MO: &[Bracket] = &[
    (1_273.0, 0.0),
    (2_546.0, 0.02),
    (3_819.0, 0.025),
    (5_092.0, 0.03),
    (6_365.0, 0.035),
    (7_638.0, 0.04),
    (8_911.0, 0.045),
    (INF, 0.048),
];

const MT_S: &[Bracket] = &[(20_500.0, 0.047), (INF, 0.059)];
const MT_J: &[Bracket] = &[(41_000.0, 0.047), (INF, 0.059)];

const NE_S: &[Bracket] = &[
    (3_700.0, 0.0246),
    (22_170.0, 0.0351),
    (35_730.0, 0.0501),
    (INF, 0.052),
];
const NE_J: &[Bracket] = &[
    (7_390.0, 0.0246),
    (44_350.0, 0.0351),
    (71_460.0, 0.0501),
    (INF, 0.052),
];

const NJ_S: &[Bracket] = &[
    (20_000.0, 0.014),
    (35_000.0, 0.0175),
    (40_000.0, 0.035),
    (75_000.0, 0.05525),
    (500_000.0, 0.0637),
    (1_000_000.0, 0.0897),
    (INF, 0.1075),
];
const NJ_J: &[Bracket] = &[
    (20_000.0, 0.014),
    (50_000.0, 0.0175),
    (70_000.0, 0.0245),
    (80_000.0, 0.035),
    (150_000.0, 0.05525),
    (500_000.0, 0.0637),
    (1_000_000.0, 0.0897),
    (INF, 0.1075),
];

const NM_S: &[Bracket] = &[
    (5_500.0, 0.015),
    (16_500.0, 0.032),
    (33_500.0, 0.043),
    (66_500.0, 0.047),
    (210_000.0, 0.049),
    (INF, 0.059),
];
const NM_J: &[Bracket] = &[
    (8_000.0, 0.015),
    (25_000.0, 0.032),
    (50_000.0, 0.043),
    (100_000.0, 0.047),
    (315_000.0, 0.049),
    (INF, 0.059),
];

const ND_S: &[Bracket] = &[(47_150.0, 0.0), (238_200.0, 0.0195), (INF, 0.025)];
const ND_J: &[Bracket] = &[(78_775.0, 0.0), (289_975.0, 0.0195), (INF, 0.025)];

const NY_SINGLE: &[Bracket] = &[
    (8_500.0, 0.04),
    (11_700.0, 0.045),
    (13_900.0, 0.0525),
    (80_650.0, 0.055),
    (215_400.0, 0.06),
    (1_077_550.0, 0.0685),
    (5_000_000.0, 0.0965),
    (25_000_000.0, 0.103),
    (INF, 0.109),
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
    (INF, 0.109),
];

const OH: &[Bracket] = &[(26_050.0, 0.0), (100_000.0, 0.0275), (INF, 0.035)];

const OK_S: &[Bracket] = &[
    (1_000.0, 0.0025),
    (2_500.0, 0.0075),
    (3_750.0, 0.0175),
    (4_900.0, 0.0275),
    (7_200.0, 0.0375),
    (INF, 0.0475),
];
const OK_J: &[Bracket] = &[
    (2_000.0, 0.0025),
    (5_000.0, 0.0075),
    (7_500.0, 0.0175),
    (9_800.0, 0.0275),
    (12_200.0, 0.0375),
    (INF, 0.0475),
];

const OR_S: &[Bracket] = &[
    (4_300.0, 0.0475),
    (10_750.0, 0.0675),
    (125_000.0, 0.0875),
    (INF, 0.099),
];
const OR_J: &[Bracket] = &[
    (8_600.0, 0.0475),
    (21_500.0, 0.0675),
    (250_000.0, 0.0875),
    (INF, 0.099),
];

const RI: &[Bracket] = &[(77_450.0, 0.0375), (176_050.0, 0.0475), (INF, 0.0599)];

const SC: &[Bracket] = &[(3_460.0, 0.0), (17_330.0, 0.03), (INF, 0.062)];

const VT_S: &[Bracket] = &[
    (45_400.0, 0.0335),
    (110_050.0, 0.066),
    (229_550.0, 0.076),
    (INF, 0.0875),
];
const VT_J: &[Bracket] = &[
    (75_850.0, 0.0335),
    (183_400.0, 0.066),
    (279_450.0, 0.076),
    (INF, 0.0875),
];

const VA: &[Bracket] = &[
    (3_000.0, 0.02),
    (5_000.0, 0.03),
    (17_000.0, 0.05),
    (INF, 0.0575),
];

const WV: &[Bracket] = &[
    (10_000.0, 0.0236),
    (25_000.0, 0.0315),
    (40_000.0, 0.0354),
    (60_000.0, 0.0472),
    (INF, 0.0512),
];

const WI_S: &[Bracket] = &[
    (14_320.0, 0.035),
    (28_640.0, 0.044),
    (315_310.0, 0.053),
    (INF, 0.0765),
];
const WI_J: &[Bracket] = &[
    (19_090.0, 0.035),
    (38_190.0, 0.044),
    (420_420.0, 0.053),
    (INF, 0.0765),
];

macro_rules! brackets {
    ($single:expr, $joint:expr, $std_s:expr, $std_j:expr) => {
        Model::Brackets {
            single: $single,
            joint: $joint,
            std_single: $std_s,
            std_joint: $std_j,
        }
    };
}

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
            model: brackets!(AL_S, AL_J, 3_000.0, 8_500.0),
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
            model: brackets!(AR, AR, 2_340.0, 4_680.0),
        },
        StateInfo {
            code: "CA",
            name: "California",
            model: brackets!(CA_SINGLE, CA_JOINT, 5_540.0, 11_080.0),
        },
        StateInfo {
            code: "CO",
            name: "Colorado",
            model: Flat(0.044),
        },
        StateInfo {
            code: "CT",
            name: "Connecticut",
            model: brackets!(CT_S, CT_J, 0.0, 0.0),
        },
        StateInfo {
            code: "DE",
            name: "Delaware",
            model: brackets!(DE, DE, 3_250.0, 6_500.0),
        },
        StateInfo {
            code: "DC",
            name: "District of Columbia",
            model: brackets!(DC, DC, 15_000.0, 30_000.0),
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
            model: brackets!(HI_S, HI_J, 8_000.0, 16_000.0),
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
            model: brackets!(KS_S, KS_J, 3_605.0, 8_240.0),
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
            model: brackets!(ME_S, ME_J, 15_000.0, 30_000.0),
        },
        StateInfo {
            code: "MD",
            name: "Maryland",
            model: brackets!(MD_S, MD_J, 2_550.0, 5_150.0),
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
            model: brackets!(MN_S, MN_J, 14_575.0, 29_150.0),
        },
        StateInfo {
            code: "MS",
            name: "Mississippi",
            model: Flat(0.044),
        },
        StateInfo {
            code: "MO",
            name: "Missouri",
            model: brackets!(MO, MO, 15_000.0, 30_000.0),
        },
        StateInfo {
            code: "MT",
            name: "Montana",
            model: brackets!(MT_S, MT_J, 15_000.0, 30_000.0),
        },
        StateInfo {
            code: "NE",
            name: "Nebraska",
            model: brackets!(NE_S, NE_J, 7_900.0, 15_800.0),
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
            model: brackets!(NJ_S, NJ_J, 0.0, 0.0),
        },
        StateInfo {
            code: "NM",
            name: "New Mexico",
            model: brackets!(NM_S, NM_J, 15_000.0, 30_000.0),
        },
        StateInfo {
            code: "NY",
            name: "New York",
            model: brackets!(NY_SINGLE, NY_JOINT, 8_000.0, 16_050.0),
        },
        StateInfo {
            code: "NC",
            name: "North Carolina",
            model: Flat(0.0425),
        },
        StateInfo {
            code: "ND",
            name: "North Dakota",
            model: brackets!(ND_S, ND_J, 0.0, 0.0),
        },
        StateInfo {
            code: "OH",
            name: "Ohio",
            model: brackets!(OH, OH, 0.0, 0.0),
        },
        StateInfo {
            code: "OK",
            name: "Oklahoma",
            model: brackets!(OK_S, OK_J, 6_350.0, 12_700.0),
        },
        StateInfo {
            code: "OR",
            name: "Oregon",
            model: brackets!(OR_S, OR_J, 2_745.0, 5_495.0),
        },
        StateInfo {
            code: "PA",
            name: "Pennsylvania",
            model: Flat(0.0307),
        },
        StateInfo {
            code: "RI",
            name: "Rhode Island",
            model: brackets!(RI, RI, 10_550.0, 21_150.0),
        },
        StateInfo {
            code: "SC",
            name: "South Carolina",
            model: brackets!(SC, SC, 15_000.0, 30_000.0),
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
            model: brackets!(VT_S, VT_J, 7_000.0, 14_050.0),
        },
        StateInfo {
            code: "VA",
            name: "Virginia",
            model: brackets!(VA, VA, 8_500.0, 17_000.0),
        },
        StateInfo {
            code: "WA",
            name: "Washington",
            model: None,
        },
        StateInfo {
            code: "WV",
            name: "West Virginia",
            model: brackets!(WV, WV, 0.0, 0.0),
        },
        StateInfo {
            code: "WI",
            name: "Wisconsin",
            model: brackets!(WI_S, WI_J, 13_230.0, 24_490.0),
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
/// flat states is the federal taxable income as a pragmatic proxy.
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
            note: format!(
                "Flat {:.2}% applied to federal taxable income.",
                rate * 100.0
            ),
        },
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
            let (tax, _) = progressive_tax(taxable, brackets);
            StateTaxResult {
                state: info.code.into(),
                state_name: info.name.into(),
                tax,
                approximate: false,
                note: "State brackets and standard deduction applied; state credits, exemptions, and local/county taxes are not modeled.".into(),
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
        Model::Flat(r) => *r,
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
