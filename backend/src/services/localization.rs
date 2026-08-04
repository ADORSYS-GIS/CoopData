use serde_json::{Map, Value};

/// Locales supported by the app — mirrors `frontend/src/i18n/locales`.
pub const SUPPORTED_LOCALES: [&str; 4] = ["en", "pt", "ss", "fr"];
/// Fallback when no translation exists for the requested language.
pub const FALLBACK_LOCALE: &str = "en";

/// Normalize a requested language string into a supported locale code.
/// Returns `None` when the value is empty or unsupported.
///
/// `lang` may be a long-form tag like `pt-PT` or `ss-SZ`; we take the primary
/// subtag before `-` and match it against the supported set.
pub fn normalize_lang(lang: Option<&str>) -> Option<String> {
    let raw = lang?;
    let primary = raw.split('-').next()?.trim().to_ascii_lowercase();
    if primary.is_empty() {
        return None;
    }
    let primary = if primary == "siswati" || primary == "sw" {
        "ss".to_string()
    } else if primary == "por" {
        "pt".to_string()
    } else if primary == "fra" {
        "fr".to_string()
    } else {
        primary
    };
    SUPPORTED_LOCALES
        .iter()
        .find(|l| **l == primary)
        .map(|l| l.to_string())
}

/// Resolve a single translatable string.
///
/// `translations` is the column value shaped `{ "<lang>": { "<field>": "...", ... } }`.
/// Lookup order: requested lang -> fallback locale entry in `translations` ->
/// the canonical (source) value.
pub fn resolve_str(canonical: &str, translations: &Value, field: &str, lang: &Option<String>) -> String {
    resolve_opt_str(Some(canonical), translations, field, lang).unwrap_or_default()
}

/// Variant of [`resolve_str`] that tolerates an optional canonical (e.g. `description`).
pub fn resolve_opt_str(
    canonical: Option<&str>,
    translations: &Value,
    field: &str,
    lang: &Option<String>,
) -> Option<String> {
    let lang_map = translations.as_object()?;
    let maybe = |l: &str| -> Option<String> {
        lang_map
            .get(l)
            .and_then(|v| v.as_object())
            .and_then(|m| m.get(field))
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
    };

    if let Some(l) = lang {
        if let Some(translated) = maybe(l) {
            return Some(translated);
        }
    }
    if let Some(fb) = maybe(FALLBACK_LOCALE) {
        return Some(fb);
    }
    canonical.map(|s| s.to_string())
}

/// Resolve a list of select options. Options are indexed arrays, so we resolve
/// positionally: `translations[lang].options[i]` replaces `options[i]`.
pub fn resolve_options(
    canonical: &[String],
    translations: &Value,
    lang: &Option<String>,
) -> Vec<String> {
    let lang_map = translations.as_object();
    let translated = |l: &str| -> Option<Vec<String>> {
        lang_map?
            .get(l)?
            .as_object()?
            .get("options")?
            .as_array()
            .map(|arr| {
                arr.iter()
                    .map(|v| v.as_str().unwrap_or_default().to_string())
                    .collect()
            })
    };

    let mut resolved = if let Some(l) = lang {
        translated(l).or_else(|| translated(FALLBACK_LOCALE))
    } else {
        translated(FALLBACK_LOCALE)
    };

    if let Some(list) = resolved.as_mut() {
        // Positional fill: keep option count aligned with canonical.
        while list.len() < canonical.len() {
            list.push(canonical[list.len()].clone());
        }
        list.truncate(canonical.len());
        list.clone()
    } else {
        canonical.to_vec()
    }
}

/// Resolve a full questionnaire template `sections` JSON array (and its wrapper
/// translations) into a localized copy. The source tree keeps `key`/`id`/`type`/
/// `icon` untouched — only human-facing text is replaced.
///
/// `translations` shape: `{ "<lang>": { "sections": { "<sectionId>": { "title", "description", "fields": { "<fieldKey>": { "label", "description", "options" } } } } } }`
pub fn resolve_sections(
    sections: &Value,
    translations: &Value,
    lang: &Option<String>,
) -> Value {
    let Some(arr) = sections.as_array() else {
        return sections.clone();
    };

    let lang_map = translations.as_object();
    let sections_translations = lang_map.and_then(|m| {
        lang
            .as_ref()
            .and_then(|l| m.get(l))
            .or_else(|| m.get(FALLBACK_LOCALE))
            .and_then(|v| v.as_object())
            .and_then(|lang_obj| lang_obj.get("sections"))
            .and_then(|v| v.as_object())
    });

    let mut out = Vec::with_capacity(arr.len());
    for section in arr {
        let Some(sec_obj) = section.as_object() else {
            out.push(section.clone());
            continue;
        };
        let mut sec = sec_obj.clone();

        let sec_id = sec_obj.get("id").and_then(|v| v.as_str()).unwrap_or_default();
        let sec_tr = sections_translations
            .and_then(|m| m.get(sec_id))
            .and_then(|v| v.as_object());

        if let Some(title) = resolve_field_str(sec_obj.get("title"), sec_tr, "title") {
            sec.insert("title".to_string(), Value::String(title));
        }
        if let Some(desc) = resolve_field_str(sec_obj.get("description"), sec_tr, "description")
        {
            sec.insert("description".to_string(), Value::String(desc));
        }

        if let Some(fields) = sec_obj.get("fields").and_then(|v| v.as_array()) {
            let mut fields_out = Vec::with_capacity(fields.len());
            for field in fields {
                let Some(f_obj) = field.as_object() else {
                    fields_out.push(field.clone());
                    continue;
                };
                let mut f = f_obj.clone();
                let f_key = f_obj.get("key").and_then(|v| v.as_str()).unwrap_or_default();
                let f_tr = sec_tr
                    .and_then(|m| m.get("fields"))
                    .and_then(|v| v.as_object())
                    .and_then(|m| m.get(f_key))
                    .and_then(|v| v.as_object());

                if let Some(label) = resolve_field_str(f_obj.get("label"), f_tr, "label") {
                    f.insert("label".to_string(), Value::String(label));
                }
                if let Some(desc) = resolve_field_str(f_obj.get("description"), f_tr, "description") {
                    f.insert("description".to_string(), Value::String(desc));
                }
                if let Some(opts) = f_obj.get("options").and_then(|v| v.as_array()) {
                    let canonical: Vec<String> = opts
                        .iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect();
                    let resolved = resolve_options_at(&canonical, f_tr);
                    f.insert("options".to_string(), Value::Array(resolved));
                }
                fields_out.push(Value::Object(f));
            }
            sec.insert("fields".to_string(), Value::Array(fields_out));
        }

        out.push(Value::Object(sec));
    }
    Value::Array(out)
}

fn resolve_field_str(
    canonical: Option<&Value>,
    tr: Option<&Map<String, Value>>,
    field: &str,
) -> Option<String> {
    let canon = canonical.and_then(|v| v.as_str());
    if let Some(map) = tr {
        if let Some(v) = map.get(field).and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
            return Some(v.to_string());
        }
    }
    canon.map(|s| s.to_string())
}

fn resolve_options_at(
    canonical: &[String],
    tr: Option<&Map<String, Value>>,
) -> Vec<Value> {
    let translated: Option<Vec<String>> = tr
        .and_then(|m| m.get("options"))
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().map(|v| v.as_str().unwrap_or_default().to_string()).collect());
    if let Some(mut list) = translated {
        while list.len() < canonical.len() {
            list.push(canonical[list.len()].clone());
        }
        list.truncate(canonical.len());
        list.iter().map(|s| Value::String(s.clone())).collect()
    } else {
        canonical.iter().map(|s| Value::String(s.clone())).collect()
    }
}

/// Resolve a translatable label for a flat entity (NF catalog / custom KPI).
pub fn resolve_label(
    canonical: &str,
    translations: &Value,
    field: &str,
    lang: &Option<String>,
) -> String {
    resolve_str(canonical, translations, field, lang)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lang(l: &str) -> Option<String> {
        normalize_lang(Some(l))
    }

    #[test]
    fn normalize_handles_long_tags() {
        assert_eq!(normalize_lang(Some("pt-PT")), Some("pt".to_string()));
        assert_eq!(normalize_lang(Some("ss-SZ")), Some("ss".to_string()));
        assert_eq!(normalize_lang(Some("FR")), Some("fr".to_string()));
        assert_eq!(normalize_lang(Some("en")), Some("en".to_string()));
        assert_eq!(normalize_lang(Some("de")), None);
        assert_eq!(normalize_lang(None), None);
    }

    #[test]
    fn resolve_str_uses_requested_lang_then_fallback_then_canonical() {
        let tr = serde_json::json!({
            "ss": { "display_name": "Igama" },
            "fr": { "display_name": "Nom" }
        });
        // requested language present
        assert_eq!(resolve_str("Name", &tr, "display_name", &lang("ss")), "Igama");
        // requested language missing -> fallback locale (en)
        assert_eq!(resolve_str("Name", &tr, "display_name", &lang("pt")), "Name");
        // no translations -> canonical
        assert_eq!(resolve_str("Name", &serde_json::json!({}), "display_name", &lang("ss")), "Name");
        // empty map, empty lang
        assert_eq!(resolve_str("Name", &serde_json::json!({}), "display_name", &None), "Name");
    }

    #[test]
    fn resolve_options_positional_fill_and_truncate() {
        let canonical = vec!["A".to_string(), "B".to_string(), "C".to_string()];
        let tr = serde_json::json!({ "ss": { "options": ["X", "Y"] } });
        let resolved = resolve_options(&canonical, &tr, &lang("ss"));
        assert_eq!(resolved, vec!["X", "Y", "C"]);
        // no translation -> canonical
        let resolved = resolve_options(&canonical, &serde_json::json!({}), &lang("ss"));
        assert_eq!(resolved, canonical);
    }

    #[test]
    fn resolve_sections_translates_tree_keeps_keys() {
        let sections = serde_json::json!([
            {
                "id": "general",
                "title": "General Information",
                "description": "Basic details",
                "fields": [
                    { "key": "n", "label": "Name", "type": "text", "options": [] },
                    { "key": "st", "label": "Status", "type": "select", "options": ["Active", "Dormant"] }
                ]
            }
        ]);
        let tr = serde_json::json!({
            "ss": {
                "sections": {
                    "general": {
                        "title": "Ulwazi",
                        "fields": {
                            "n": { "label": "Igama" },
                            "st": { "label": "Isimo", "options": ["Kusebenta", "Kulele"] }
                        }
                    }
                }
            }
        });
        let out = resolve_sections(&sections, &tr, &lang("ss"));
        let sec = &out[0];
        assert_eq!(sec["id"], "general");
        assert_eq!(sec["title"], "Ulwazi");
        assert_eq!(sec["fields"][0]["key"], "n");
        assert_eq!(sec["fields"][0]["label"], "Igama");
        assert_eq!(sec["fields"][1]["options"], serde_json::json!(["Kusebenta", "Kulele"]));
    }

    #[test]
    fn resolve_sections_falls_back_to_canonical_when_missing() {
        let sections = serde_json::json!([
            { "id": "g", "title": "General", "fields": [{ "key": "a", "label": "A", "options": [] }] }
        ]);
        let out = resolve_sections(&sections, &serde_json::json!({"ss": {"sections": {}}}), &lang("ss"));
        assert_eq!(out[0]["title"], "General");
        assert_eq!(out[0]["fields"][0]["label"], "A");
    }
}
