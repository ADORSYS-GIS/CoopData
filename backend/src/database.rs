use sea_orm::{ConnectOptions, Database as SeaDatabase, DatabaseConnection, DbErr};
use std::time::Duration;

pub type Database = DatabaseConnection;

pub async fn connect(database_url: &str) -> Result<DatabaseConnection, DbErr> {
    let mut opt = ConnectOptions::new(database_url);
    opt.max_connections(100)
        .min_connections(5)
        .connect_timeout(Duration::from_secs(5))
        .acquire_timeout(Duration::from_secs(5));

    SeaDatabase::connect(opt).await
}
