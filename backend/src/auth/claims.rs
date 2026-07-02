use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
    pub iss: String,
    #[serde(default)]
    pub aud: Option<serde_json::Value>,
    #[serde(default)]
    pub preferred_username: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub email_verified: Option<bool>,
    #[serde(default)]
    pub realm_access: Option<RealmAccess>,
    #[serde(default)]
    pub resource_access: Option<ResourceAccess>,
    #[serde(default)]
    pub organization: Option<serde_json::Value>,
    #[serde(default)]
    pub cooperation: Option<Cooperation>,
    #[serde(default)]
    pub assigned_dimensions: Option<serde_json::Value>,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RealmAccess {
    pub roles: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceAccess {
    #[serde(flatten)]
    pub resources: HashMap<String, ResourceRoles>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceRoles {
    pub roles: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Cooperation(pub Vec<String>);

impl Claims {
    pub fn user_id(&self) -> &str {
        &self.sub
    }

    pub fn username(&self) -> Option<&str> {
        self.preferred_username.as_deref()
    }

    pub fn has_role(&self, role: &str) -> bool {
        self.realm_access
            .as_ref()
            .map(|ra| ra.roles.iter().any(|r| r == role))
            .unwrap_or(false)
    }

    pub fn has_any_role(&self, roles: &[&str]) -> bool {
        self.realm_access
            .as_ref()
            .map(|ra| ra.roles.iter().any(|r| roles.contains(&r.as_str())))
            .unwrap_or(false)
    }

    pub fn is_ministry(&self) -> bool {
        self.has_role("ministry")
    }

    pub fn is_federation(&self) -> bool {
        self.has_role("federation")
    }

    pub fn is_apex(&self) -> bool {
        self.has_role("apex")
    }

    pub fn is_cooperative(&self) -> bool {
        self.has_role("cooperative")
    }

    pub fn get_organization_id(&self) -> Option<String> {
        self.organization.as_ref().and_then(|org| {
            if let serde_json::Value::Object(map) = org {
                for (_name, val) in map {
                    if let serde_json::Value::Object(inner) = val {
                        if let Some(id) = inner.get("id").and_then(|v| v.as_str()) {
                            return Some(id.to_string());
                        }
                    }
                }
            }
            None
        })
    }

    pub fn get_organization_name(&self) -> Option<String> {
        self.organization.as_ref().and_then(|org| {
            if let serde_json::Value::Object(map) = org {
                if let Some((name, _val)) = map.iter().next() {
                    return Some(name.clone());
                }
            }
            None
        })
    }

    pub fn get_cooperation_paths(&self) -> Vec<String> {
        self.cooperation
            .as_ref()
            .map(|c| c.0.clone())
            .unwrap_or_default()
    }

    /// Returns the apex group identifier from the `cooperation` claim.
    /// The claim contains paths like "/group-name" or "/uuid/subgroup-uuid".
    /// Returns the first path (may be a name-based path or a UUID).
    pub fn get_apex_group_id(&self) -> Option<String> {
        self.cooperation.as_ref().and_then(|c| {
            c.0.first().map(|path| {
                // Strip leading slash, take first segment (the apex group name or UUID)
                let without_slash = path.strip_prefix('/').unwrap_or(path);
                without_slash
                    .split('/')
                    .next()
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| without_slash.to_string())
            })
        })
    }

    /// Returns the raw cooperation path (e.g. "/we" or "/uuid/subuuid").
    /// Use this when you need to resolve the group via path lookup.
    pub fn get_apex_group_path(&self) -> Option<String> {
        self.cooperation.as_ref().and_then(|c| c.0.first().cloned())
    }

    pub fn get_assigned_dimensions(&self) -> Vec<String> {
        self.assigned_dimensions
            .as_ref()
            .map(|v| match v {
                serde_json::Value::Array(arr) => arr
                    .iter()
                    .filter_map(|item| item.as_str().map(String::from))
                    .collect(),
                _ => vec![],
            })
            .unwrap_or_default()
    }

    pub fn all_roles(&self) -> Vec<String> {
        let mut roles = Vec::new();
        if let Some(ra) = &self.realm_access {
            roles.extend(ra.roles.iter().cloned());
        }
        roles.sort();
        roles.dedup();
        roles
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_claims_with_roles(roles: Vec<&str>) -> Claims {
        Claims {
            sub: "test-user-id".to_string(),
            exp: 9999999999,
            iat: 0,
            iss: "test-issuer".to_string(),
            aud: None,
            preferred_username: Some("testuser".to_string()),
            email: Some("test@example.com".to_string()),
            email_verified: Some(true),
            realm_access: Some(RealmAccess {
                roles: roles.iter().map(|s| s.to_string()).collect(),
            }),
            resource_access: None,
            organization: None,
            cooperation: None,
            assigned_dimensions: None,
            name: Some("Test User".to_string()),
        }
    }

    fn make_ministry_claims() -> Claims {
        make_claims_with_roles(vec!["ministry"])
    }

    fn make_federation_claims() -> Claims {
        let mut claims = make_claims_with_roles(vec!["federation"]);
        claims.organization = Some(serde_json::json!({
            "TestFederation": { "id": "fed-org-123" }
        }));
        claims
    }

    fn make_apex_claims() -> Claims {
        let mut claims = make_claims_with_roles(vec!["apex"]);
        claims.cooperation = Some(Cooperation(vec![
            "/apex-group-456/cooperative-789".to_string()
        ]));
        claims
    }

    fn make_cooperative_claims() -> Claims {
        let mut claims = make_claims_with_roles(vec!["cooperative"]);
        claims.cooperation = Some(Cooperation(vec![
            "/apex-group-456/cooperative-789".to_string()
        ]));
        claims
    }

    // ─── user_id ────────────────────────────────────────────────────────────────

    #[test]
    fn test_user_id_returns_sub() {
        let claims = make_claims_with_roles(vec!["ministry"]);
        assert_eq!(claims.user_id(), "test-user-id");
    }

    // ─── username ───────────────────────────────────────────────────────────────

    #[test]
    fn test_username_returns_preferred_username() {
        let claims = make_claims_with_roles(vec!["ministry"]);
        assert_eq!(claims.username(), Some("testuser"));
    }

    #[test]
    fn test_username_returns_none_when_absent() {
        let mut claims = make_claims_with_roles(vec!["ministry"]);
        claims.preferred_username = None;
        assert!(claims.username().is_none());
    }

    // ─── has_role ───────────────────────────────────────────────────────────────

    #[test]
    fn test_has_role_true() {
        let claims = make_claims_with_roles(vec!["ministry"]);
        assert!(claims.has_role("ministry"));
    }

    #[test]
    fn test_has_role_false() {
        let claims = make_claims_with_roles(vec!["ministry"]);
        assert!(!claims.has_role("federation"));
    }

    #[test]
    fn test_has_role_no_realm_access() {
        let mut claims = make_claims_with_roles(vec!["ministry"]);
        claims.realm_access = None;
        assert!(!claims.has_role("ministry"));
    }

    // ─── has_any_role ──────────────────────────────────────────────────────────

    #[test]
    fn test_has_any_role_match() {
        let claims = make_claims_with_roles(vec!["apex", "cooperative"]);
        assert!(claims.has_any_role(&["ministry", "apex"]));
    }

    #[test]
    fn test_has_any_role_no_match() {
        let claims = make_claims_with_roles(vec!["cooperative"]);
        assert!(!claims.has_any_role(&["ministry", "federation"]));
    }

    #[test]
    fn test_has_any_role_empty_roles() {
        let claims = make_claims_with_roles(vec!["ministry"]);
        assert!(!claims.has_any_role(&[]));
    }

    // ─── is_ministry / is_federation / is_apex / is_cooperative ────────────────

    #[test]
    fn test_is_ministry() {
        assert!(make_ministry_claims().is_ministry());
        assert!(!make_federation_claims().is_ministry());
    }

    #[test]
    fn test_is_federation() {
        assert!(make_federation_claims().is_federation());
        assert!(!make_ministry_claims().is_federation());
    }

    #[test]
    fn test_is_apex() {
        assert!(make_apex_claims().is_apex());
        assert!(!make_ministry_claims().is_apex());
    }

    #[test]
    fn test_is_cooperative() {
        assert!(make_cooperative_claims().is_cooperative());
        assert!(!make_ministry_claims().is_cooperative());
    }

    // ─── get_organization_id ───────────────────────────────────────────────────

    #[test]
    fn test_get_organization_id_from_json_object() {
        let claims = make_federation_claims();
        assert_eq!(
            claims.get_organization_id(),
            Some("fed-org-123".to_string())
        );
    }

    #[test]
    fn test_get_organization_id_none_when_absent() {
        let claims = make_ministry_claims();
        assert!(claims.get_organization_id().is_none());
    }

    // ─── get_organization_name ──────────────────────────────────────────────────

    #[test]
    fn test_get_organization_name() {
        let claims = make_federation_claims();
        assert_eq!(
            claims.get_organization_name(),
            Some("TestFederation".to_string())
        );
    }

    #[test]
    fn test_get_organization_name_none_when_absent() {
        let claims = make_ministry_claims();
        assert!(claims.get_organization_name().is_none());
    }

    // ─── get_cooperation_paths ────────────────────────────────────────────────

    #[test]
    fn test_get_cooperation_paths() {
        let claims = make_apex_claims();
        let paths = claims.get_cooperation_paths();
        assert_eq!(paths.len(), 1);
        assert_eq!(paths[0], "/apex-group-456/cooperative-789");
    }

    #[test]
    fn test_get_cooperation_paths_empty() {
        let claims = make_ministry_claims();
        assert!(claims.get_cooperation_paths().is_empty());
    }

    // ─── get_apex_group_id ────────────────────────────────────────────────────

    #[test]
    fn test_get_apex_group_id() {
        let claims = make_apex_claims();
        assert_eq!(
            claims.get_apex_group_id(),
            Some("apex-group-456".to_string())
        );
    }

    #[test]
    fn test_get_apex_group_id_strips_leading_slash() {
        let mut claims = make_claims_with_roles(vec!["apex"]);
        claims.cooperation = Some(Cooperation(vec!["/my-apex-group/coop-1".to_string()]));
        assert_eq!(
            claims.get_apex_group_id(),
            Some("my-apex-group".to_string())
        );
    }

    #[test]
    fn test_get_apex_group_id_none_when_no_cooperation() {
        let claims = make_ministry_claims();
        assert!(claims.get_apex_group_id().is_none());
    }

    // ─── get_assigned_dimensions ──────────────────────────────────────────────

    #[test]
    fn test_get_assigned_dimensions_from_array() {
        let mut claims = make_claims_with_roles(vec!["cooperative"]);
        claims.assigned_dimensions = Some(serde_json::json!(["dimension1", "dimension2"]));
        let dims = claims.get_assigned_dimensions();
        assert_eq!(dims, vec!["dimension1", "dimension2"]);
    }

    #[test]
    fn test_get_assigned_dimensions_empty() {
        let claims = make_ministry_claims();
        assert!(claims.get_assigned_dimensions().is_empty());
    }

    // ─── all_roles ────────────────────────────────────────────────────────────

    #[test]
    fn test_all_roles_deduplicates() {
        let claims = make_claims_with_roles(vec!["ministry", "ministry"]);
        // all_roles should deduplicate
        let roles = claims.all_roles();
        assert_eq!(roles, vec!["ministry".to_string()]);
    }

    #[test]
    fn test_all_roles_sorted() {
        let claims = make_claims_with_roles(vec!["cooperative", "apex", "ministry"]);
        let roles = claims.all_roles();
        assert_eq!(roles, vec!["apex", "cooperative", "ministry"]);
    }

    #[test]
    fn test_all_roles_empty() {
        let mut claims = make_claims_with_roles(vec![]);
        claims.realm_access = None;
        assert!(claims.all_roles().is_empty());
    }

    // ─── Cooperation deserialization ──────────────────────────────────────────

    #[test]
    fn test_cooperation_deserialize() {
        let json = r#"["/path1", "/path2"]"#;
        let coop: Cooperation = serde_json::from_str(json).unwrap();
        assert_eq!(coop.0.len(), 2);
        assert_eq!(coop.0[0], "/path1");
        assert_eq!(coop.0[1], "/path2");
    }

    #[test]
    fn test_cooperation_default() {
        let coop = Cooperation::default();
        assert!(coop.0.is_empty());
    }
}
