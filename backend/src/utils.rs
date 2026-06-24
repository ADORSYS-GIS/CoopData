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