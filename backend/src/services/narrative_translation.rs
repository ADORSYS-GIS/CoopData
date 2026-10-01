//! Multilingual AI narratives: "generate once in English, translate many".
//!
//! The expensive financial analysis runs once in English. The finished paragraphs
//! (no financial tables) are then translated into every other report locale, and
//! each translation is validated before it is accepted so a report never ships with
//! altered figures or untranslated English labelled as another language.

use std::collections::BTreeSet;

use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::services::report_narrative::ReportNarrativeGenerator;

/// Locales the AI narratives are translated into, with the language name used in prompts.
pub const TRANSLATION_TARGETS: [(&str, &str); 3] =
    [("fr", "French"), ("pt", "Portuguese"), ("ss", "Siswati")];

/// Attempts per locale before falling back to English.
const MAX_ATTEMPTS: u32 = 3;

/// Fields at least this long must not come back identical to the English text;
/// shorter ones (e.g. a lone acronym) may legitimately be unchanged.
const MIN_LEN_REQUIRING_CHANGE: usize = 40;

/// One narrative set per supported report locale, as stored in metadata under
/// `ai_narratives` (submissions) or `ai_narratives_{year}` (apex / federation).
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct Multilingual<T> {
    pub en: T,
    pub fr: T,
    pub pt: T,
    pub ss: T,
    /// Locales that hold an English copy because translation failed. They are
    /// retried the next time narratives are requested.
    #[serde(default)]
    pub untranslated: Vec<String>,
}

impl<T: Clone> Multilingual<T> {
    /// Every locale holds the English text and is marked for translation.
    pub fn english_only(en: T) -> Self {
        Self {
            fr: en.clone(),
            pt: en.clone(),
            ss: en.clone(),
            en,
            untranslated: TRANSLATION_TARGETS
                .iter()
                .map(|(code, _)| (*code).to_string())
                .collect(),
        }
    }

    pub fn get(&self, lng: &str) -> &T {
        match lng {
            "fr" => &self.fr,
            "pt" => &self.pt,
            "ss" => &self.ss,
            _ => &self.en,
        }
    }

    fn set(&mut self, lng: &str, value: T) {
        match lng {
            "fr" => self.fr = value,
            "pt" => self.pt = value,
            "ss" => self.ss = value,
            _ => self.en = value,
        }
    }

    pub fn is_complete(&self) -> bool {
        self.untranslated.is_empty()
    }
}

/// Narratives read back from metadata, in either the multilingual shape or the
/// legacy English-only shape written before multilingual reports existed.
pub enum StoredNarratives<T> {
    Multilingual(Multilingual<T>),
    Legacy(T),
}

pub fn parse_stored<T: DeserializeOwned>(value: &serde_json::Value) -> Option<StoredNarratives<T>> {
    if value.get("en").is_some() {
        serde_json::from_value(value.clone())
            .ok()
            .map(StoredNarratives::Multilingual)
    } else {
        serde_json::from_value(value.clone())
            .ok()
            .map(StoredNarratives::Legacy)
    }
}

/// Picks the narratives for one locale out of a stored metadata value, accepting
/// both the multilingual and the legacy English-only shape.
pub fn select_locale(value: serde_json::Value, lng: &str) -> serde_json::Value {
    match value.get("en") {
        Some(en) => value.get(lng).cloned().unwrap_or_else(|| en.clone()),
        None => value,
    }
}

/// Translates English narratives into every target locale concurrently.
/// Locales whose translation fails validation keep the English text and are
/// listed in `untranslated`.
pub async fn translate_all<T>(
    generator: &dyn ReportNarrativeGenerator,
    english: &T,
) -> Multilingual<T>
where
    T: Serialize + DeserializeOwned + Clone + Send + Sync,
{
    let mut result = Multilingual::english_only(english.clone());
    result.untranslated.clear();
    retranslate(generator, &mut result, &all_targets()).await;
    result
}

/// Fills the locales listed in `untranslated` of an existing multilingual set.
pub async fn complete_missing<T>(
    generator: &dyn ReportNarrativeGenerator,
    narratives: &mut Multilingual<T>,
) where
    T: Serialize + DeserializeOwned + Clone + Send + Sync,
{
    let pending: Vec<String> = std::mem::take(&mut narratives.untranslated);
    retranslate(generator, narratives, &pending).await;
}

fn all_targets() -> Vec<String> {
    TRANSLATION_TARGETS
        .iter()
        .map(|(code, _)| (*code).to_string())
        .collect()
}

async fn retranslate<T>(
    generator: &dyn ReportNarrativeGenerator,
    narratives: &mut Multilingual<T>,
    codes: &[String],
) where
    T: Serialize + DeserializeOwned + Clone + Send + Sync,
{
    let english = match serde_json::to_value(&narratives.en) {
        Ok(serde_json::Value::Object(map)) => map,
        _ => {
            tracing::error!("[translation] English narratives are not a JSON object");
            narratives.untranslated = codes.to_vec();
            return;
        }
    };

    let wanted = |code: &str| codes.iter().any(|c| c == code);
    let start = std::time::Instant::now();
    let (fr, pt, ss) = tokio::join!(
        translate_if(wanted("fr"), generator, &english, "French"),
        translate_if(wanted("pt"), generator, &english, "Portuguese"),
        translate_if(wanted("ss"), generator, &english, "Siswati"),
    );

    for (code, outcome) in [("fr", fr), ("pt", pt), ("ss", ss)] {
        match outcome {
            None => {}
            Some(Ok(value)) => narratives.set(code, value),
            Some(Err(reason)) => {
                tracing::warn!(lng = code, reason = %reason, "[translation] ⚠️ Falling back to English");
                narratives.set(code, narratives.en.clone());
                narratives.untranslated.push(code.to_string());
            }
        }
    }

    tracing::info!(
        elapsed_ms = start.elapsed().as_millis(),
        untranslated = ?narratives.untranslated,
        "[translation] 🌍 Translation step finished"
    );
}

async fn translate_if<T: DeserializeOwned>(
    wanted: bool,
    generator: &dyn ReportNarrativeGenerator,
    english: &serde_json::Map<String, serde_json::Value>,
    language: &str,
) -> Option<Result<T, String>> {
    if wanted {
        Some(translate_one(generator, english, language).await)
    } else {
        None
    }
}

async fn translate_one<T: DeserializeOwned>(
    generator: &dyn ReportNarrativeGenerator,
    english: &serde_json::Map<String, serde_json::Value>,
    language: &str,
) -> Result<T, String> {
    let payload = serde_json::to_string_pretty(english).map_err(|e| e.to_string())?;
    let mut last_error = String::new();

    for attempt in 1..=MAX_ATTEMPTS {
        // Transport failures already went through the LLM client's own retry loop.
        let raw = generator
            .translate_narrative_json(&payload, language)
            .await
            .map_err(|e| format!("{language} translation request failed: {e}"))?;

        match validate_translation(english, &raw)
            .and_then(|value| serde_json::from_value::<T>(value).map_err(|e| e.to_string()))
        {
            Ok(translated) => return Ok(translated),
            Err(reason) => {
                tracing::warn!(
                    language,
                    attempt,
                    reason = %reason,
                    "[translation] Rejected {} translation (attempt {}/{})",
                    language,
                    attempt,
                    MAX_ATTEMPTS
                );
                last_error = reason;
            }
        }
    }

    Err(last_error)
}

/// Checks a raw LLM translation against the English source: same keys, every
/// field translated, and every figure of the English text still present.
pub fn validate_translation(
    english: &serde_json::Map<String, serde_json::Value>,
    raw: &str,
) -> Result<serde_json::Value, String> {
    let cleaned = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    let parsed: serde_json::Value =
        serde_json::from_str(cleaned).map_err(|e| format!("invalid JSON: {e}"))?;
    let translated = parsed
        .as_object()
        .ok_or_else(|| "translation is not a JSON object".to_string())?;

    for (key, source) in english {
        let source = source.as_str().unwrap_or_default();
        let target = translated
            .get(key)
            .and_then(|v| v.as_str())
            .ok_or_else(|| format!("missing field `{key}`"))?;

        if source.trim().is_empty() {
            continue;
        }
        if target.trim().is_empty() {
            return Err(format!("field `{key}` is empty"));
        }
        if source.len() >= MIN_LEN_REQUIRING_CHANGE && target.trim() == source.trim() {
            return Err(format!("field `{key}` was left in English"));
        }
        let missing: Vec<String> = figures(source)
            .difference(&figures(target))
            .cloned()
            .collect();
        if !missing.is_empty() {
            return Err(format!("field `{key}` lost figures {missing:?}"));
        }
    }

    let mut only_known = serde_json::Map::new();
    for key in english.keys() {
        if let Some(v) = translated.get(key) {
            only_known.insert(key.clone(), v.clone());
        }
    }
    Ok(serde_json::Value::Object(only_known))
}

/// A number in any locale's notation: digit groups joined by a comma, a dot, a
/// (narrow) no-break space, or a plain space followed by exactly three digits.
fn number_pattern() -> &'static regex::Regex {
    static NUMBER: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    NUMBER.get_or_init(|| {
        regex::Regex::new(r"\d+(?:[.,\u{00A0}\u{202F}]\d+| \d{3}\b)*")
            .expect("number pattern is a valid regex")
    })
}

/// The figures of a text, each reduced to its digits so that `1,234.5`, `1 234,5`
/// and `1.234,5` compare equal. Whole numbers below ten are left out: translators
/// legitimately write counts such as "one cooperative" as words.
fn figures(text: &str) -> BTreeSet<String> {
    number_pattern()
        .find_iter(text)
        .map(|m| {
            m.as_str()
                .chars()
                .filter(char::is_ascii_digit)
                .collect::<String>()
        })
        .filter(|digits| digits.len() > 1)
        .collect()
}

/// Prompt for translating one flat JSON object of English narrative paragraphs.
pub fn translation_prompt(english_json: &str, language: &str) -> String {
    let language_notes = match language {
        "French" => {
            "Use standard French as written in official regulatory documents. \
             Use established terms such as « coopérative d'épargne et de crédit », \
             « portefeuille à risque », « ratio de liquidité », « fonds propres », \
             « rentabilité des actifs ». Use French number conventions \
             (decimal comma, space as thousands separator, a space before %)."
        }
        "Portuguese" => {
            "Use European Portuguese (as used in Mozambique and Portugal), \
             not Brazilian Portuguese. Use established terms such as \
             «cooperativa de poupança e crédito», «carteira em risco», «rácio de liquidez», \
             «capitais próprios», «rendibilidade do ativo». Use Portuguese number \
             conventions (decimal comma, space as thousands separator)."
        }
        "Siswati" => {
            "Write in siSwati, the official language of Eswatini (ISO 639-1 \"ss\"). \
             It is NOT Swahili and NOT isiZulu: do not use Swahili or Zulu vocabulary or \
             spelling. Use the vocabulary of official siSwati government and banking \
             communication. Where siSwati has no established word for a \
             technical finance term, write a short siSwati explanation followed by the \
             English term in parentheses the first time it appears."
        }
        _ => "",
    };

    format!(
        r#"You are a professional translator of financial supervision reports on savings and credit cooperatives.

Translate every value of the JSON object below from English into {language}.
{language_notes}

RULES:
- Return ONLY a JSON object with exactly the same keys. Never translate the keys. No markdown fences, no commentary.
- Translate every sentence completely. Do not leave any English sentence in the output.
- Keep every figure: the same digits, years, percentages and amounts as the English text. Never round, recompute, drop or spell out a number in words. You may only change the decimal and thousands separators to the {language} convention.
- Keep unchanged: currency codes (SZL, E, USD, ...), indicator acronyms (PAR, PAR30, ROA, ROE, OSS, CAR, PEARLS, KPI, AGM) and the names of cooperatives, apexes, federations, regions and people.
- Use the formal register of an official supervisory report. Preserve paragraph breaks ("\n") and list structure.

English JSON:
{english_json}"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::report_narrative::{CooperativeNarratives, MockNarrativeGenerator};

    fn english() -> serde_json::Map<String, serde_json::Value> {
        serde_json::json!({
            "executive_summary": "Total assets grew by 12.5% to SZL 1,234,567 in 2024, while PAR30 stood at 4.2%.",
            "risk_watch": "Stable."
        })
        .as_object()
        .cloned()
        .unwrap_or_default()
    }

    #[test]
    fn accepts_translation_with_locale_separators() {
        let raw = r#"{"executive_summary":"L'actif total a augmenté de 12,5 % pour atteindre SZL 1 234 567 en 2024, tandis que le PAR30 s'établissait à 4,2 %.","risk_watch":"Stable."}"#;

        let result = validate_translation(&english(), raw);

        assert!(result.is_ok(), "{result:?}");
    }

    #[test]
    fn rejects_translation_that_changes_a_figure() {
        let raw = r#"{"executive_summary":"L'actif total a augmenté de 13 % pour atteindre SZL 1 234 567 en 2024, tandis que le PAR30 s'établissait à 4,2 %.","risk_watch":"Stable."}"#;

        let result = validate_translation(&english(), raw);

        assert!(result.unwrap_err().contains("lost figures"));
    }

    #[test]
    fn accepts_small_counts_written_as_words() {
        let english = serde_json::json!({
            "executive_dashboard": "1 cooperative breached the 5% PAR limit while total assets reached SZL 1,234,567."
        })
        .as_object()
        .cloned()
        .unwrap_or_default();
        let raw = r#"{"executive_dashboard":"Une coopérative a dépassé la limite de PAR de 5 %, tandis que le total de l'actif atteignait SZL 1 234 567."}"#;

        let result = validate_translation(&english, raw);

        assert!(result.is_ok(), "{result:?}");
    }

    #[test]
    fn rejects_text_left_in_english() {
        let raw = serde_json::to_string(&english()).unwrap_or_default();

        let result = validate_translation(&english(), &raw);

        assert!(result.unwrap_err().contains("left in English"));
    }

    #[test]
    fn rejects_missing_field_and_strips_fences() {
        let raw = "```json\n{\"executive_summary\":\"L'actif total a augmenté de 12,5 % — SZL 1 234 567 en 2024, PAR30 à 4,2 %.\"}\n```";

        let result = validate_translation(&english(), raw);

        assert!(result.unwrap_err().contains("missing field `risk_watch`"));
    }

    #[test]
    fn select_locale_handles_both_shapes() {
        let multi = serde_json::json!({ "en": { "a": "x" }, "fr": { "a": "y" } });
        let legacy = serde_json::json!({ "a": "x" });

        assert_eq!(
            select_locale(multi.clone(), "fr"),
            serde_json::json!({ "a": "y" })
        );
        assert_eq!(select_locale(multi, "ss"), serde_json::json!({ "a": "x" }));
        assert_eq!(select_locale(legacy.clone(), "fr"), legacy);
    }

    #[tokio::test]
    async fn untranslated_locales_fall_back_to_english_and_are_flagged() {
        let en = CooperativeNarratives {
            executive_summary:
                "The cooperative remained solvent throughout the reporting year 2024.".into(),
            ..Default::default()
        };

        // The mock echoes the English text back, which validation must reject.
        let result = translate_all(&MockNarrativeGenerator, &en).await;

        assert_eq!(result.fr.executive_summary, en.executive_summary);
        assert_eq!(result.untranslated, vec!["fr", "pt", "ss"]);
        assert!(!result.is_complete());
    }

    #[test]
    fn parse_stored_detects_legacy_shape() {
        let legacy = serde_json::to_value(CooperativeNarratives::default()).unwrap_or_default();

        let parsed = parse_stored::<CooperativeNarratives>(&legacy);

        assert!(matches!(parsed, Some(StoredNarratives::Legacy(_))));
    }
}
