// backend/tests/legal_policy_test.rs
use coop_data_backend::api::dto::legal_policy::{LegalPolicyCreateRequest, LegalPolicyUpdateRequest, LegalPolicyResponse};
use coop_data_backend::entities::legal_policy;
use uuid::Uuid;
use chrono::Utc;

#[test]
fn test_legal_policy_dto_conversion() {
    let now = Utc::now();
    let id = Uuid::new_v4();
    let policy_id = Uuid::new_v4();

    let model = legal_policy::Model {
        id,
        policy_id,
        slug: "privacy-test".to_string(),
        title_en: "Privacy Policy Test".to_string(),
        title_fr: "Politique de test".to_string(),
        title_pt: "Política de Privacidade Teste".to_string(),
        title_ss: "Inqubomgomo Yebumfihlo Test".to_string(),
        content_en: "# Test Privacy".to_string(),
        content_fr: "# Test Confidentialite".to_string(),
        content_pt: "# Teste de Privacidade".to_string(),
        content_ss: "# Test Yebumfihlo".to_string(),
        version: 1,
        created_at: now,
        updated_at: now,
    };

    let dto: LegalPolicyResponse = LegalPolicyResponse::from(model);

    assert_eq!(dto.id, id);
    assert_eq!(dto.policy_id, policy_id);
    assert_eq!(dto.slug, "privacy-test");
    assert_eq!(dto.title_en, "Privacy Policy Test");
    assert_eq!(dto.version, 1);
}

#[test]
fn test_legal_policy_create_request() {
    let req = LegalPolicyCreateRequest {
        slug: "terms".to_string(),
        title_en: "Terms of Service".to_string(),
        title_fr: "Conditions d'utilisation".to_string(),
        title_pt: "Termos de Serviço".to_string(),
        title_ss: "Imigomo Yekusebentisa".to_string(),
        content_en: "Terms content".to_string(),
        content_fr: "Contenu des conditions".to_string(),
        content_pt: "Conteúdo dos termos".to_string(),
        content_ss: "Lokuqukethwe kwemigomo".to_string(),
    };

    assert_eq!(req.slug, "terms");
    assert_eq!(req.title_en, "Terms of Service");
}

#[test]
fn test_legal_policy_update_request() {
    let req = LegalPolicyUpdateRequest {
        title_en: Some("Updated Terms".to_string()),
        title_fr: None,
        title_pt: None,
        title_ss: None,
        content_en: Some("Updated Content".to_string()),
        content_fr: None,
        content_pt: None,
        content_ss: None,
    };

    assert_eq!(req.title_en.as_deref(), Some("Updated Terms"));
    assert!(req.title_fr.is_none());
}
