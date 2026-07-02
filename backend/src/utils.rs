use crate::error::AppError;

pub trait IntoAppResult<T> {
    fn into_app_result(self) -> Result<T, AppError>;
}

impl<T, E: Into<AppError>> IntoAppResult<T> for Result<T, E> {
    fn into_app_result(self) -> Result<T, AppError> {
        self.map_err(Into::into)
    }
}

macro_rules! impl_from_error {
    ($from:ty, $to:ident) => {
        impl From<$from> for AppError {
            fn from(err: $from) -> Self {
                AppError::$to(err.to_string())
            }
        }
    };
}

impl_from_error!(std::io::Error, InternalServerError);
impl_from_error!(serde_json::Error, InternalServerError);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_into_app_result_ok() {
        let result: std::result::Result<i32, std::io::Error> = Ok(42);
        let mapped: Result<i32, AppError> = result.into_app_result();
        assert_eq!(mapped.expect("expected ok"), 42);
    }

    #[test]
    fn test_into_app_result_err_maps_to_internal_server_error() {
        let result: std::result::Result<i32, std::io::Error> = Err(std::io::Error::other("boom"));
        let mapped: Result<i32, AppError> = result.into_app_result();
        assert!(mapped.is_err());
        match mapped {
            Err(AppError::InternalServerError(msg)) => assert!(msg.contains("boom")),
            other => panic!("Expected InternalServerError, got {:?}", other),
        }
    }

    #[test]
    fn test_from_serde_json_error() {
        let err: AppError = serde_json::from_str::<serde_json::Value>("not json")
            .unwrap_err()
            .into();
        assert!(matches!(err, AppError::InternalServerError(_)));
    }

    #[test]
    fn test_from_io_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "missing");
        let app_err: AppError = io_err.into();
        assert!(matches!(app_err, AppError::InternalServerError(_)));
    }
}
