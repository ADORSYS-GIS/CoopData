use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateOrganizationLabelRequest {
    pub label: String,
    pub short_label: String,
    pub plural_label: String,
    pub description: Option<String>,
    pub icon: String,
    pub translations: serde_json::Value,
}

impl UpdateOrganizationLabelRequest {
    pub fn validate(&self) -> AppResult<()> {
        let label = self.label.trim();
        if label.is_empty() || label.len() > 100 {
            return Err(AppError::BadRequest(
                "label must be between 1 and 100 characters".into(),
            ));
        }
        let short_label = self.short_label.trim();
        if short_label.is_empty() || short_label.len() > 50 {
            return Err(AppError::BadRequest(
                "short_label must be between 1 and 50 characters".into(),
            ));
        }
        let plural_label = self.plural_label.trim();
        if plural_label.is_empty() || plural_label.len() > 100 {
            return Err(AppError::BadRequest(
                "plural_label must be between 1 and 100 characters".into(),
            ));
        }
        if let Some(ref desc) = self.description {
            if desc.len() > 500 {
                return Err(AppError::BadRequest(
                    "description cannot exceed 500 characters".into(),
                ));
            }
        }
        let icon = self.icon.trim();
        if icon.is_empty() || icon.len() > 100 {
            return Err(AppError::BadRequest(
                "icon must be between 1 and 100 characters".into(),
            ));
        }
        if !icon
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
        {
            return Err(AppError::BadRequest(
                "icon contains invalid characters".into(),
            ));
        }
        // Translations schema validation
        if let Some(obj) = self.translations.as_object() {
            const ALLOWED_LANGS: &[&str] = &["en", "fr", "pt", "ss"];
            for (lang, val) in obj {
                if !ALLOWED_LANGS.contains(&lang.as_str()) {
                    return Err(AppError::BadRequest(format!(
                        "Unsupported translation language '{}'",
                        lang
                    )));
                }
                if !val.is_object() {
                    return Err(AppError::BadRequest(format!(
                        "Translation for '{}' must be an object",
                        lang
                    )));
                }
            }
        } else {
            return Err(AppError::BadRequest(
                "translations must be a JSON object".into(),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema, Clone)]
pub struct OrganizationLabelResponse {
    pub key: String,
    pub label: String,
    pub short_label: String,
    pub plural_label: String,
    pub description: Option<String>,
    pub icon: String,
    pub translations: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

impl From<crate::entities::organization_label::Model> for OrganizationLabelResponse {
    fn from(m: crate::entities::organization_label::Model) -> Self {
        Self {
            key: m.key,
            label: m.label,
            short_label: m.short_label,
            plural_label: m.plural_label,
            description: m.description,
            icon: m.icon,
            translations: m.translations,
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.to_rfc3339(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_valid_request() {
        let req = UpdateOrganizationLabelRequest {
            label: "Federation".into(),
            short_label: "Fed".into(),
            plural_label: "Federations".into(),
            description: Some("Regional body".into()),
            icon: "Network".into(),
            translations: json!({"en": {"label": "Federation"}}),
        };
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_invalid_label_empty() {
        let req = UpdateOrganizationLabelRequest {
            label: "   ".into(),
            short_label: "Fed".into(),
            plural_label: "Federations".into(),
            description: None,
            icon: "Network".into(),
            translations: json!({}),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_invalid_icon() {
        let req = UpdateOrganizationLabelRequest {
            label: "Federation".into(),
            short_label: "Fed".into(),
            plural_label: "Federations".into(),
            description: None,
            icon: "Network<script>".into(),
            translations: json!({}),
        };
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_invalid_translation_lang() {
        let req = UpdateOrganizationLabelRequest {
            label: "Federation".into(),
            short_label: "Fed".into(),
            plural_label: "Federations".into(),
            description: None,
            icon: "Network".into(),
            translations: json!({"invalid_lang": {"label": "Test"}}),
        };
        assert!(req.validate().is_err());
    }
}
