use std::collections::HashMap;

/// Minimum number of contributing cooperatives-with-data required before an
/// average slice is disclosed. Below this, the average would reveal individual
/// data (differential-privacy guard). Shared by every slice (national,
/// regional, sector, sector+regional) of both benchmarking endpoints.
pub const MIN_CONTRIBUTORS: usize = 3;

/// Computes an average over rows matching `predicate`, withholding the slice
/// when fewer than `MIN_CONTRIBUTORS` rows contribute.
///
/// `get_value` extracts a metric value from a row, returning `None` when the
/// row has no value for that key (so per-metric averages run over
/// rows-with-data only, matching the frontend semantics).
pub fn scoped_average<T>(
    rows: &[T],
    predicate: impl Fn(&T) -> bool,
    get_value: impl Fn(&T, &str) -> Option<f64>,
    keys: &[&str],
) -> (Option<HashMap<String, f64>>, bool) {
    let matching: Vec<&T> = rows.iter().filter(|r| predicate(r)).collect();
    if matching.len() < MIN_CONTRIBUTORS {
        return (None, true);
    }
    (Some(average_over(&matching, get_value, keys)), false)
}

/// Averages each key over the given rows, using only values that are present
/// and not NaN.
pub fn average_over<T>(
    rows: &[&T],
    get_value: impl Fn(&T, &str) -> Option<f64>,
    keys: &[&str],
) -> HashMap<String, f64> {
    keys.iter()
        .map(|key| {
            let vals: Vec<f64> = rows
                .iter()
                .filter_map(|r| get_value(r, key))
                .filter(|v| !v.is_nan())
                .collect();
            let avg = if vals.is_empty() {
                0.0
            } else {
                vals.iter().sum::<f64>() / vals.len() as f64
            };
            (key.to_string(), avg)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Row {
        has_data: bool,
        value: Option<f64>,
    }

    fn row(has_data: bool, value: Option<f64>) -> Row {
        Row { has_data, value }
    }

    #[test]
    fn averages_over_matching_rows() {
        let rows = vec![
            row(true, Some(10.0)),
            row(true, Some(20.0)),
            row(true, Some(30.0)),
        ];
        let (avg, insufficient) = scoped_average(
            &rows,
            |r| r.has_data,
            |r, key| if key == "m" { r.value } else { None },
            &["m"],
        );
        assert!(!insufficient);
        assert_eq!(avg.unwrap()["m"], 20.0);
    }

    #[test]
    fn withholds_when_fewer_than_min_contributors() {
        let rows = vec![row(true, Some(10.0)), row(true, Some(20.0))];
        let (avg, insufficient) = scoped_average(
            &rows,
            |r| r.has_data,
            |r, key| if key == "m" { r.value } else { None },
            &["m"],
        );
        assert!(insufficient);
        assert!(avg.is_none());
    }

    #[test]
    fn predicate_filters_out_non_matching_rows() {
        let rows = vec![
            row(true, Some(10.0)),
            row(false, Some(99.0)),
            row(true, Some(20.0)),
            row(true, Some(30.0)),
        ];
        let (avg, insufficient) = scoped_average(
            &rows,
            |r| r.has_data,
            |r, key| if key == "m" { r.value } else { None },
            &["m"],
        );
        assert!(!insufficient);
        assert_eq!(avg.unwrap()["m"], 20.0);
    }

    #[test]
    fn ignores_nan_and_missing_values() {
        let rows = vec![
            row(true, Some(f64::NAN)),
            row(true, None),
            row(true, Some(4.0)),
        ];
        let (avg, _) = scoped_average(
            &rows,
            |r| r.has_data,
            |r, key| if key == "m" { r.value } else { None },
            &["m"],
        );
        assert_eq!(avg.unwrap()["m"], 4.0);
    }

    #[test]
    fn averages_every_key_independently() {
        let rows = vec![
            row(true, Some(10.0)),
            row(true, Some(30.0)),
            row(true, Some(20.0)),
        ];
        let (avg, _) = scoped_average(
            &rows,
            |r| r.has_data,
            |r, key| {
                if key == "m" {
                    r.value
                } else if key == "n" {
                    r.value.map(|v| v * 2.0)
                } else {
                    None
                }
            },
            &["m", "n"],
        );
        let averages = avg.unwrap();
        assert_eq!(averages["m"], 20.0);
        assert_eq!(averages["n"], 40.0);
    }
}
