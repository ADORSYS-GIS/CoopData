use axum::Router;
use utoipa::OpenApi;

use crate::api as api_module;
use crate::AppState;

pub fn create_openapi_spec() -> utoipa::openapi::OpenApi {
    ApiDoc::openapi()
}

#[derive(OpenApi)]
#[openapi(
    info(
        title = "CoopData API",
        version = "0.1.0",
        description = "Cooperative Data Management Platform API with RBAC hierarchy (Ministry → Federation → Apex → Cooperative)",
        contact(name = "CoopData Team", email = "support@coopdata.org")
    ),
    paths(
        api_module::handlers::health_check,
        api_module::handlers::list_organizations,
        api_module::handlers::get_organization,
        api_module::handlers::create_organization,
        api_module::handlers::update_organization,
        api_module::handlers::delete_organization,
        api_module::handlers::list_users,
        api_module::handlers::get_user,
        api_module::handlers::create_user,
        api_module::handlers::update_user,
        api_module::handlers::delete_user,
        api_module::handlers::assign_role_to_user,
        api_module::handlers::federation::create_federation,
        api_module::handlers::federation::list_federations,
        api_module::handlers::federation::get_federation,
        api_module::handlers::federation::update_federation,
        api_module::handlers::federation::delete_federation,
        api_module::handlers::federation::invite_user_to_federation,
        api_module::handlers::federation::list_federation_invitations,
        api_module::handlers::federation::delete_federation_invitation,
        api_module::handlers::federation::resend_federation_invitation,
        api_module::handlers::federation::list_federation_members,
        api_module::handlers::apex::create_apex,
        api_module::handlers::apex::list_apexes,
        api_module::handlers::apex::get_apex,
        api_module::handlers::apex::update_apex,
        api_module::handlers::apex::delete_apex,
        api_module::handlers::apex::add_apex_member,
        api_module::handlers::apex::list_apex_members,
        api_module::handlers::apex::remove_apex_member,
        api_module::handlers::cooperative::create_cooperative,
        api_module::handlers::cooperative::list_cooperatives,
        api_module::handlers::cooperative::get_cooperative,
        api_module::handlers::cooperative::update_cooperative,
        api_module::handlers::cooperative::delete_cooperative,
        api_module::handlers::cooperative::add_cooperative_member,
        api_module::handlers::cooperative::list_cooperative_members,
        api_module::handlers::cooperative::remove_cooperative_member,
        api_module::handlers::me::get_current_user_profile,
    ),
    components(schemas(
        api_module::dto::PaginationParams,
        api_module::dto::ErrorResponse,
        api_module::dto::SuccessResponse,
        api_module::dto::PaginatedOrganizationResponse,
        api_module::dto::PaginatedUserResponse,
        api_module::dto::CreateOrganizationRequest,
        api_module::dto::UpdateOrganizationRequest,
        api_module::dto::OrganizationResponse,
        api_module::dto::CreateUserRequest,
        api_module::dto::UpdateUserRequest,
        api_module::dto::UserResponse,
        api_module::dto::AssignRoleRequest,
        api_module::dto::federation::CreateFederationRequest,
        api_module::dto::federation::UpdateFederationRequest,
        api_module::dto::federation::FederationResponse,
        api_module::dto::federation::DomainRequest,
        api_module::dto::federation::DomainResponse,
        api_module::dto::apex::CreateApexRequest,
        api_module::dto::apex::UpdateApexRequest,
        api_module::dto::apex::ApexResponse,
        api_module::dto::apex::CooperativeBriefResponse,
        api_module::dto::cooperative::CreateCooperativeRequest,
        api_module::dto::cooperative::UpdateCooperativeRequest,
        api_module::dto::cooperative::CooperativeResponse,
        api_module::dto::invitation::CreateInvitationRequest,
        api_module::dto::invitation::InvitationResponse,
        api_module::dto::member::AddMemberRequest,
        api_module::dto::member::MemberResponse,
        api_module::dto::member::UserProfileResponse,
    ))
)]
pub struct ApiDoc;

pub fn serve_openapi() -> Router<AppState> {
    let spec = ApiDoc::openapi();
    let spec_json = serde_json::to_string(&spec).expect("Failed to serialize OpenAPI spec");

    Router::new()
        .route(
            "/api-docs/openapi.json",
            axum::routing::get(move || {
                let json = spec_json.clone();
                async move { axum::Json(serde_json::from_str::<serde_json::Value>(&json).unwrap()) }
            }),
        )
        .route(
            "/swagger-ui",
            axum::routing::get(|| async move { axum::response::Html(SWAGGER_UI_HTML.to_string()) }),
        )
        .route(
            "/swagger-ui/",
            axum::routing::get(|| async move { axum::response::Html(SWAGGER_UI_HTML.to_string()) }),
        )
}

const SWAGGER_UI_HTML: &str = r#"<!DOCTYPE html>
<html>
<head>
    <title>CoopData API - Swagger UI</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
    window.onload = function() {
        SwaggerUIBundle({
            url: "/api-docs/openapi.json",
            dom_id: '#swagger-ui',
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.SwaggerUIBundle
            ],
        })
    }
    </script>
</body>
</html>"#;
