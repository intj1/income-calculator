//! REST API for the income calculator. The GitHub Pages deployment uses the
//! WASM build instead; this server exists for self-hosted / API use cases and
//! can also serve the built Angular app from `FRONTEND_DIST`.

use axum::{
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use income_calc_core::{CalculationInput, ProjectionInput};
use serde_json::{json, Value};
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "tax_year": income_calc_core::federal::TAX_YEAR }))
}

async fn states() -> Json<Value> {
    Json(serde_json::to_value(income_calc_core::state_list()).unwrap_or_else(|_| json!([])))
}

async fn calculate(
    Json(input): Json<CalculationInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let output = income_calc_core::calculate(&input);
    serde_json::to_value(&output).map(Json).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })
}

async fn project(
    Json(input): Json<ProjectionInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let output = income_calc_core::project(&input);
    serde_json::to_value(&output).map(Json).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
    })
}

#[tokio::main]
async fn main() {
    let api = Router::new()
        .route("/health", get(health))
        .route("/states", get(states))
        .route("/calculate", post(calculate))
        .route("/project", post(project))
        .layer(CorsLayer::permissive());

    let mut app = Router::new().nest("/api", api);
    if let Ok(dist) = std::env::var("FRONTEND_DIST") {
        app = app.fallback_service(ServeDir::new(dist));
    }

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind failed");
    println!("income-calc-server listening on http://{addr}");
    axum::serve(listener, app).await.expect("server error");
}
