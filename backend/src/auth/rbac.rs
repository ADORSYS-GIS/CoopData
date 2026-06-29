//! RBAC (Role-Based Access Control) module for the 4-level IAM hierarchy.
//!
//! This module provides role constants and scope enforcement helpers
//! for the Ministry → Federation → Apex → Cooperative hierarchy.

use crate::auth::Claims;
use crate::AppError;

/// Role names as defined in Keycloak realm.
/// These represent the 4-level hierarchy:
/// - Ministry (Level 1): Platform super-admin
/// - Federation (Level 2): Organization admin
/// - Apex (Level 3): Group admin
/// - Cooperative (Level 4): End user
pub mod roles {
    pub const MINISTRY: &str = "ministry";
    pub const FEDERATION: &str = "federation";
    pub const APEX: &str = "apex";
    pub const COOPERATIVE: &str = "cooperative";

    pub const ALL: &[&str] = &[MINISTRY, FEDERATION, APEX, COOPERATIVE];
}

/// Route prefixes for each role level.
/// Maps directly to the API URL structure.
pub mod route_prefix {
    pub const MINISTRY: &str = "/api/v1/ministry";
    pub const FEDERATION: &str = "/api/v1/federation";
    pub const APEX: &str = "/api/v1/apex";
    pub const COOPERATIVE: &str = "/api/v1/cooperative";
    pub const SHARED: &str = "/api/v1";
}

/// Scope enforcement helpers for extracting and validating
/// organization/group membership from JWT claims.
pub struct ScopeEnforcement;

impl ScopeEnforcement {
    /// Validates that a Federation user can only access resources
    /// within their own organization.
    ///
    /// # Arguments
    /// * `claims` - The JWT claims containing user identity and roles
    /// * `organization_keycloak_id` - The organization ID being accessed
    ///
    /// # Returns
    /// * `Ok(())` if the user belongs to the organization
    /// * `Err(AppError::Forbidden)` if scope violation
    pub fn federation_can_access_org(
        claims: &Claims,
        organization_keycloak_id: &str,
    ) -> Result<(), AppError> {
        let user_org_id = claims.get_organization_id().ok_or_else(|| {
            AppError::Forbidden("User has no organization associated".to_string())
        })?;

        if user_org_id != organization_keycloak_id {
            tracing::warn!(
                user_org_id = %user_org_id,
                requested_org_id = %organization_keycloak_id,
                "Federation scope violation: user attempted to access another organization"
            );
            return Err(AppError::Forbidden(
                "Access denied: you can only access resources within your own federation"
                    .to_string(),
            ));
        }

        Ok(())
    }

    /// Validates that an Apex user can only access cooperatives
    /// within their own group.
    ///
    /// # Arguments
    /// * `claims` - The JWT claims containing user identity and roles
    /// * `apex_keycloak_id` - The apex group ID being accessed
    ///
    /// # Returns
    /// * `Ok(())` if the user belongs to the apex group
    /// * `Err(AppError::Forbidden)` if scope violation
    pub fn apex_can_access_group(claims: &Claims, apex_keycloak_id: &str) -> Result<(), AppError> {
        let user_group_id = claims
            .get_apex_group_id()
            .ok_or_else(|| AppError::Forbidden("User has no apex group associated".to_string()))?;

        if user_group_id != apex_keycloak_id {
            tracing::warn!(
                user_group_id = %user_group_id,
                requested_group_id = %apex_keycloak_id,
                "Apex scope violation: user attempted to access another apex group"
            );
            return Err(AppError::Forbidden(
                "Access denied: you can only access cooperatives within your own apex".to_string(),
            ));
        }

        Ok(())
    }

    /// Extracts the organization ID for a Federation user.
    /// Returns error if the user doesn't have an organization.
    pub fn get_federation_org_id(claims: &Claims) -> Result<String, AppError> {
        claims.get_organization_id().ok_or_else(|| {
            AppError::Forbidden("Federation user has no organization associated".to_string())
        })
    }

    /// Extracts the apex group ID for an Apex user.
    /// Returns error if the user doesn't have a cooperation group.
    pub fn get_apex_group_id(claims: &Claims) -> Result<String, AppError> {
        claims.get_apex_group_id().ok_or_else(|| {
            AppError::Forbidden("Apex user has no cooperation group associated".to_string())
        })
    }

    /// Extracts the cooperative subgroup ID for a Cooperative user.
    /// Parses the full cooperation path to extract the subgroup UUID.
    pub fn get_cooperative_id(claims: &Claims) -> Result<String, AppError> {
        let paths = claims.get_cooperation_paths();
        let path = paths.first().ok_or_else(|| {
            AppError::Forbidden("Cooperative user has no cooperation group associated".to_string())
        })?;

        // Path format: "/apex-group-uuid/cooperative-subgroup-uuid"
        let without_slash = path.strip_prefix('/').unwrap_or(path);
        let parts: Vec<&str> = without_slash.split('/').collect();

        parts
            .get(1)
            .map(|s| s.to_string())
            .ok_or_else(|| AppError::Forbidden("Invalid cooperation path format".to_string()))
    }

    /// Checks if a user has any of the specified roles.
    pub fn has_any_role(claims: &Claims, roles: &[&str]) -> bool {
        claims.has_any_role(roles)
    }

    /// Checks if user is a Ministry admin (Level 1).
    pub fn is_ministry(claims: &Claims) -> bool {
        claims.is_ministry()
    }

    /// Checks if user is a Federation admin (Level 2).
    pub fn is_federation(claims: &Claims) -> bool {
        claims.is_federation()
    }

    /// Checks if user is an Apex admin (Level 3).
    pub fn is_apex(claims: &Claims) -> bool {
        claims.is_apex()
    }

    /// Checks if user is a Cooperative member (Level 4).
    pub fn is_cooperative(claims: &Claims) -> bool {
        claims.is_cooperative()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::claims::RealmAccess;

    fn make_claims_with_roles(roles: Vec<&str>) -> Claims {
        Claims {
            sub: "test-user-id".to_string(),
            exp: 9999999999,
            iat: 0,
            iss: "test".to_string(),
            aud: None,
            preferred_username: None,
            email: None,
            email_verified: None,
            realm_access: Some(RealmAccess {
                roles: roles.iter().map(|s| s.to_string()).collect(),
            }),
            resource_access: None,
            organization: None,
            cooperation: None,
            assigned_dimensions: None,
            name: None,
        }
    }

    #[test]
    fn test_role_constants() {
        assert_eq!(roles::MINISTRY, "ministry");
        assert_eq!(roles::FEDERATION, "federation");
        assert_eq!(roles::APEX, "apex");
        assert_eq!(roles::COOPERATIVE, "cooperative");
    }

    #[test]
    fn test_is_ministry() {
        let ministry_claims = make_claims_with_roles(vec!["ministry"]);
        let federation_claims = make_claims_with_roles(vec!["federation"]);

        assert!(ScopeEnforcement::is_ministry(&ministry_claims));
        assert!(!ScopeEnforcement::is_ministry(&federation_claims));
    }

    #[test]
    fn test_has_any_role() {
        let claims = make_claims_with_roles(vec!["cooperative", "apex"]);

        assert!(ScopeEnforcement::has_any_role(
            &claims,
            &[roles::COOPERATIVE]
        ));
        assert!(ScopeEnforcement::has_any_role(&claims, &[roles::APEX]));
        assert!(ScopeEnforcement::has_any_role(
            &claims,
            &[roles::COOPERATIVE, roles::APEX]
        ));
        assert!(!ScopeEnforcement::has_any_role(&claims, &[roles::MINISTRY]));
    }
}
