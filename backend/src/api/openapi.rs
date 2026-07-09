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
        api_module::handlers::federation::delete_federation_preview,
        api_module::handlers::federation::invite_user_to_federation,
        api_module::handlers::federation::list_federation_invitations,
        api_module::handlers::federation::delete_federation_invitation,
        api_module::handlers::federation::resend_federation_invitation,
        api_module::handlers::federation::list_federation_members,
        api_module::handlers::federation::remove_federation_member,
        api_module::handlers::apex::create_apex,
        api_module::handlers::apex::list_apexes,
        api_module::handlers::apex::get_apex,
        api_module::handlers::apex::update_apex,
        api_module::handlers::apex::delete_apex,
        api_module::handlers::apex::delete_apex_preview,
        api_module::handlers::apex::add_apex_member,
        api_module::handlers::apex::list_apex_members,
        api_module::handlers::apex::remove_apex_member,
        api_module::handlers::apex::update_apex_member,
        api_module::handlers::apex::resend_apex_member_verification,
        api_module::handlers::cooperative::create_cooperative,
        api_module::handlers::cooperative::list_cooperatives,
        api_module::handlers::cooperative::get_cooperative,
        api_module::handlers::cooperative::update_cooperative,
        api_module::handlers::cooperative::delete_cooperative,
        api_module::handlers::cooperative::delete_cooperative_preview,
        api_module::handlers::cooperative::add_cooperative_member,
        api_module::handlers::cooperative::list_cooperative_members,
        api_module::handlers::cooperative::remove_cooperative_member,
        api_module::handlers::cooperative::update_cooperative_member,
        api_module::handlers::cooperative::resend_cooperative_member_verification,
        api_module::handlers::cooperative::get_apex_profile,
        api_module::handlers::cooperative::create_cooperative_profile,
        api_module::handlers::cooperative::list_cooperative_profiles,
        api_module::handlers::cooperative::get_cooperative_profile,
        api_module::handlers::cooperative::update_cooperative_profile,
        api_module::handlers::cooperative::delete_cooperative_profile,
        api_module::handlers::me::get_current_user_profile,
        api_module::handlers::me::change_password,
        api_module::handlers::me::verify_identity,
        api_module::handlers::federation::get_federation_profile,
        api_module::handlers::federation::update_federation_profile,
        api_module::handlers::federation::get_federation_stats,
        api_module::handlers::audit::list_audit_logs,
        api_module::handlers::non_financial::upload_non_financial,
        api_module::handlers::non_financial::list_members,
        api_module::handlers::non_financial::get_member,
        api_module::handlers::non_financial::create_member,
        api_module::handlers::non_financial::update_member,
        api_module::handlers::non_financial::delete_member,
        api_module::handlers::non_financial::list_savings_accounts,
        api_module::handlers::non_financial::get_savings_account,
        api_module::handlers::non_financial::create_savings_account,
        api_module::handlers::non_financial::update_savings_account,
        api_module::handlers::non_financial::delete_savings_account,
        api_module::handlers::non_financial::list_loans,
        api_module::handlers::non_financial::get_loan,
        api_module::handlers::non_financial::create_loan,
        api_module::handlers::non_financial::update_loan,
        api_module::handlers::non_financial::delete_loan,
        api_module::handlers::non_financial::list_fixed_deposits,
        api_module::handlers::non_financial::get_fixed_deposit,
        api_module::handlers::non_financial::create_fixed_deposit,
        api_module::handlers::non_financial::update_fixed_deposit,
        api_module::handlers::non_financial::delete_fixed_deposit,
    ),
    components(schemas(
        api_module::dto::PaginationParams,
        api_module::dto::ErrorResponse,
        api_module::dto::SuccessResponse,
        api_module::dto::PaginatedOrganizationResponse,
        api_module::dto::PaginatedUserResponse,
        api_module::dto::PaginatedApexResponse,
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
        api_module::dto::federation::FederationStatsResponse,
        api_module::dto::apex::CreateApexRequest,
        api_module::dto::apex::UpdateApexRequest,
        api_module::dto::apex::ApexResponse,
        api_module::dto::apex::CooperativeBriefResponse,
        api_module::dto::cooperative::CreateCooperativeRequest,
        api_module::dto::cooperative::UpdateCooperativeRequest,
        api_module::dto::cooperative::CooperativeResponse,
        api_module::dto::cooperative::CreateCooperativeProfileRequest,
        api_module::dto::cooperative::UpdateCooperativeProfileRequest,
        api_module::dto::cooperative::CooperativeProfileResponse,
        api_module::dto::invitation::CreateInvitationRequest,
        api_module::dto::invitation::InvitationResponse,
        api_module::dto::member::AddMemberRequest,
        api_module::dto::member::MemberResponse,
        api_module::dto::member::UpdateMemberRequest,
        api_module::dto::member::UserProfileResponse,
        api_module::dto::member::ChangePasswordRequest,
        api_module::dto::member::ChangePasswordResponse,
        api_module::dto::verification::VerifyIdentityRequest,
        api_module::dto::verification::VerifyIdentityResponse,
        api_module::dto::verification::DeletePreviewResponse,
        api_module::dto::common::PaginatedApexResponse,
        api_module::dto::audit::AuditLogResponse,
        api_module::dto::audit::PaginatedAuditLogResponse,
        api_module::dto::audit::AuditLogFilterParams,
        api_module::dto::non_financial::CreateMemberRequest,
        api_module::dto::non_financial::UpdateMemberRequest,
        api_module::dto::non_financial::MemberResponse,
        api_module::dto::non_financial::CreateSavingsAccountRequest,
        api_module::dto::non_financial::UpdateSavingsAccountRequest,
        api_module::dto::non_financial::SavingsAccountResponse,
        api_module::dto::non_financial::CreateLoanRequest,
        api_module::dto::non_financial::UpdateLoanRequest,
        api_module::dto::non_financial::LoanResponse,
        api_module::dto::non_financial::CreateFixedDepositRequest,
        api_module::dto::non_financial::UpdateFixedDepositRequest,
        api_module::dto::non_financial::FixedDepositResponse,
        api_module::dto::non_financial::NfUploadResponse,
        api_module::dto::non_financial::NfListQueryParams,
        api_module::dto::non_financial::PaginatedMembersResponse,
        api_module::dto::non_financial::PaginatedSavingsAccountsResponse,
        api_module::dto::non_financial::PaginatedLoansResponse,
        api_module::dto::non_financial::PaginatedFixedDepositsResponse,
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
