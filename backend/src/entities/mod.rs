pub mod assessment;
pub mod organization;
pub mod user;

pub use assessment::{
    Column as AssessmentColumn, Entity as AssessmentEntity, Model as AssessmentModel,
};
pub use organization::{
    Column as OrganizationColumn, Entity as OrganizationEntity, Model as OrganizationModel,
};
pub use user::{Column as UserColumn, Entity as UserEntity, Model as UserModel};
