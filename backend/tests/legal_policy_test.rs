// backend/tests/legal_policy_test.rs
use chrono::Utc;
use coop_data_backend::api::dto::legal_policy::LegalPolicyResponse;
use coop_data_backend::entities::legal_policy;
use uuid::Uuid;

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
