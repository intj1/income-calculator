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

fn error_json(msg: &str) -> String {
    format!(
        "{{\"error\":{}}}",
        serde_json::to_string(msg).unwrap_or_else(|_| "\"error\"".into())
    )
}
