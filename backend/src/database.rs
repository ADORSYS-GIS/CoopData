use sea_orm::{
    ConnectOptions, Database as SeaDatabase, DatabaseBackend, DatabaseConnection, DbErr,
    ExecResult, QueryResult, Statement,
};
use std::sync::Arc;
use std::time::Duration;

/// Shareable SeaORM connection handle.
///
/// A thin `Arc` wrapper around [`DatabaseConnection`]. SeaORM only derives
/// `Clone` for `DatabaseConnection` when the `mock` feature is disabled, so the
/// cloneable handle is wrapped here once and shared by every repository and
/// handler. The wrapper implements `ConnectionTrait`/`TransactionTrait`, so
/// sea-orm executors accept `&Database` directly, and deref coercion keeps
/// call sites that expect `&DatabaseConnection` working unchanged.
#[derive(Clone)]
pub struct Database(Arc<DatabaseConnection>);

impl Database {
    pub fn new(conn: DatabaseConnection) -> Self {
        Self(Arc::new(conn))
    }
}

impl From<DatabaseConnection> for Database {
    fn from(conn: DatabaseConnection) -> Self {
        Self::new(conn)
    }
}

impl Default for Database {
    fn default() -> Self {
        Self::new(DatabaseConnection::default())
    }
}

impl std::ops::Deref for Database {
    type Target = DatabaseConnection;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl std::fmt::Debug for Database {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_tuple("Database").field(&self.0).finish()
    }
}

#[async_trait::async_trait]
impl sea_orm::ConnectionTrait for Database {
    fn get_database_backend(&self) -> DatabaseBackend {
        self.0.get_database_backend()
    }

    async fn execute(&self, stmt: Statement) -> Result<ExecResult, DbErr> {
        self.0.execute(stmt).await
    }

    async fn execute_unprepared(&self, sql: &str) -> Result<ExecResult, DbErr> {
        self.0.execute_unprepared(sql).await
    }

    async fn query_one(&self, stmt: Statement) -> Result<Option<QueryResult>, DbErr> {
        self.0.query_one(stmt).await
    }

    async fn query_all(&self, stmt: Statement) -> Result<Vec<QueryResult>, DbErr> {
        self.0.query_all(stmt).await
    }
}

#[async_trait::async_trait]
impl sea_orm::TransactionTrait for Database {
    async fn begin(&self) -> Result<sea_orm::DatabaseTransaction, DbErr> {
        self.0.begin().await
    }

    async fn begin_with_config(
        &self,
        isolation_level: Option<sea_orm::IsolationLevel>,
        access_mode: Option<sea_orm::AccessMode>,
    ) -> Result<sea_orm::DatabaseTransaction, DbErr> {
        self.0.begin_with_config(isolation_level, access_mode).await
    }

    async fn transaction<F, T, E>(&self, callback: F) -> Result<T, sea_orm::TransactionError<E>>
    where
        F: for<'c> std::ops::FnOnce(
                &'c sea_orm::DatabaseTransaction,
            ) -> std::pin::Pin<
                Box<dyn std::future::Future<Output = Result<T, E>> + std::marker::Send + 'c>,
            > + std::marker::Send,
        T: std::marker::Send,
        E: std::fmt::Display + std::fmt::Debug + std::marker::Send,
    {
        self.0.transaction(callback).await
    }

    async fn transaction_with_config<F, T, E>(
        &self,
        callback: F,
        isolation_level: Option<sea_orm::IsolationLevel>,
        access_mode: Option<sea_orm::AccessMode>,
    ) -> Result<T, sea_orm::TransactionError<E>>
    where
        F: for<'c> std::ops::FnOnce(
                &'c sea_orm::DatabaseTransaction,
            ) -> std::pin::Pin<
                Box<dyn std::future::Future<Output = Result<T, E>> + std::marker::Send + 'c>,
            > + std::marker::Send,
        T: std::marker::Send,
        E: std::fmt::Display + std::fmt::Debug + std::marker::Send,
    {
        self.0
            .transaction_with_config(callback, isolation_level, access_mode)
            .await
    }
}

pub async fn connect(database_url: &str) -> Result<Database, DbErr> {
    let mut opt = ConnectOptions::new(database_url);
    opt.max_connections(20)
        .min_connections(2)
        .connect_timeout(Duration::from_secs(30))
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(600))
        .max_lifetime(Duration::from_secs(1800))
        .sqlx_logging(false);

    SeaDatabase::connect(opt).await.map(Database::new)
}
