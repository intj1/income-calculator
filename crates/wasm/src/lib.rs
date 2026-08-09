//! WASM surface: JSON strings in, JSON strings out — keeps the JS binding
//! layer trivial and versioned by the core's serde schema.

use wasm_bindgen::prelude::*;

/// Run a full income calculation. Input/output are JSON (CalculationInput /
/// CalculationOutput). Returns `{"error": "..."}` on malformed input.
#[wasm_bindgen]
pub fn calculate(input_json: &str) -> String {
    match serde_json::from_str::<income_calc_core::CalculationInput>(input_json) {
        Ok(input) => {
            let output = income_calc_core::calculate(&input);
            serde_json::to_string(&output).unwrap_or_else(|e| error_json(&e.to_string()))
        }
        Err(e) => error_json(&format!("invalid input: {e}")),
    }
}

/// Savings / investment projection. JSON ProjectionInput -> ProjectionOutput.
#[wasm_bindgen]
pub fn project(input_json: &str) -> String {
    match serde_json::from_str::<income_calc_core::ProjectionInput>(input_json) {
        Ok(input) => {
            let output = income_calc_core::project(&input);
            serde_json::to_string(&output).unwrap_or_else(|e| error_json(&e.to_string()))
        }
        Err(e) => error_json(&format!("invalid input: {e}")),
    }
}

/// List of supported states for dropdowns.
#[wasm_bindgen]
pub fn states() -> String {
    serde_json::to_string(&income_calc_core::state_list()).unwrap_or_else(|_| "[]".into())
}

/// Supported tax years, e.g. [2024, 2025, 2026].
#[wasm_bindgen]
pub fn tax_years() -> String {
    serde_json::to_string(&income_calc_core::supported_years()).unwrap_or_else(|_| "[]".into())
}

/// Solve for the first income source's amount needed to hit a desired annual
/// net income. Input is a JSON CalculationInput; returns a JSON SolveResult.
#[wasm_bindgen]
pub fn solve_required_gross(input_json: &str, desired_net_annual: f64) -> String {
    match serde_json::from_str::<income_calc_core::CalculationInput>(input_json) {
        Ok(input) => {
            let result = income_calc_core::solve_required_gross(&input, desired_net_annual);
            serde_json::to_string(&result).unwrap_or_else(|e| error_json(&e.to_string()))
        }
        Err(e) => error_json(&format!("invalid input: {e}")),
    }
}

/// Gross→net curve sweeping the first income source. JSON CalculationInput
/// in, JSON Vec<CurvePoint> out.
#[wasm_bindgen]
pub fn income_curve(input_json: &str, points: usize, max_amount: f64) -> String {
    match serde_json::from_str::<income_calc_core::CalculationInput>(input_json) {
        Ok(input) => {
            let curve = income_calc_core::income_curve(&input, points, max_amount);
            serde_json::to_string(&curve).unwrap_or_else(|e| error_json(&e.to_string()))
        }
        Err(e) => error_json(&format!("invalid input: {e}")),
    }
}

/// Net income per state for the same scenario, sorted highest first. JSON
/// CalculationInput in, JSON Vec<StateNetEntry> out.
#[wasm_bindgen]
pub fn state_sweep(input_json: &str) -> String {
    match serde_json::from_str::<income_calc_core::CalculationInput>(input_json) {
        Ok(input) => {
            let sweep = income_calc_core::state_sweep(&input);
            serde_json::to_string(&sweep).unwrap_or_else(|e| error_json(&e.to_string()))
        }
        Err(e) => error_json(&format!("invalid input: {e}")),
    }
}

/// 401(k) contribution optimizer sweep (0..max_percent). JSON
/// CalculationInput in, JSON Vec<K401Point> out.
#[wasm_bindgen]
pub fn k401_curve(input_json: &str, max_percent: f64) -> String {
    match serde_json::from_str::<income_calc_core::CalculationInput>(input_json) {
        Ok(input) => {
            let curve = income_calc_core::k401_curve(&input, max_percent);
            serde_json::to_string(&curve).unwrap_or_else(|e| error_json(&e.to_string()))
        }
        Err(e) => error_json(&format!("invalid input: {e}")),
    }
}

/// Marriage bonus/penalty sweep over a hypothetical partner's income. JSON
/// CalculationInput in, JSON Vec<MarriagePoint> out.
#[wasm_bindgen]
pub fn marriage_sweep(input_json: &str, points: usize, max_partner_income: f64) -> String {
    match serde_json::from_str::<income_calc_core::CalculationInput>(input_json) {
        Ok(input) => {
            let sweep = income_calc_core::marriage_sweep(&input, points, max_partner_income);
            serde_json::to_string(&sweep).unwrap_or_else(|e| error_json(&e.to_string()))
        }
        Err(e) => error_json(&format!("invalid input: {e}")),
    }
}

/// Roth vs Traditional lifetime comparison. JSON RothTradInput in,
/// JSON RothTradOutput out.
#[wasm_bindgen]
pub fn roth_vs_traditional(input_json: &str) -> String {
    match serde_json::from_str::<income_calc_core::RothTradInput>(input_json) {
        Ok(input) => {
            let out = income_calc_core::roth_vs_traditional(&input);
            serde_json::to_string(&out).unwrap_or_else(|e| error_json(&e.to_string()))
        }
        Err(e) => error_json(&format!("invalid input: {e}")),
    }
}

fn error_json(msg: &str) -> String {
    format!(
        "{{\"error\":{}}}",
        serde_json::to_string(msg).unwrap_or_else(|_| "\"error\"".into())
    )
}
