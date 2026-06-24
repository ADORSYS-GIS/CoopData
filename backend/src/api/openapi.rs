use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::api as api_module;

pub fn create_openapi_router() -> SwaggerUi {
    SwaggerUi::new("/swagger-ui")
        .url("/api-docs/openapi.json", ApiDoc::openapi())
}

#[derive(OpenApi)]
#[openapi(
    info(
        title = "CoopData API",
        version = "0.1.0",
        description = "Eswatini National Cooperative Management Platform API",
        contact(
            name = "CoopData Team",
            email = "support@coopdata.org"
        )
    ),
    paths(
        api_module::handlers::health_check,
    ),
    components(schemas(
        api_module::dto::PaginationParams,
        api_module::dto::ErrorResponse,
        api_module::dto::SuccessResponse,
    ))
)]
pub struct ApiDoc;