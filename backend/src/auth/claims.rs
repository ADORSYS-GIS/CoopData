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

    pub fn get_apex_group_id(&self) -> Option<String> {
        self.cooperation.as_ref().and_then(|c| {
            c.0.first().and_then(|path| {
                let without_slash = path.strip_prefix('/').unwrap_or(path);
                without_slash.split('/').next().map(|s| s.to_string())
            })
        })
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
