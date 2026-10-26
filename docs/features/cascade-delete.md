# Deleting a federation, apex or cooperative

Deleting an item removes everything below it and everything filed under it.

| Delete | Removes |
| --- | --- |
| Federation | its apexes, their cooperatives, all their submissions and data, users, groups, stored files and report PDFs |
| Apex | its cooperatives, their submissions and data, users, groups, stored files and report PDFs |
| Cooperative | its submissions and data, users, group, stored files and report PDFs |

## How it works

`services::hierarchy_delete` does all three, in this order:

1. **Read** what Keycloak holds below the target. Nothing is changed yet; if
   Keycloak cannot be read the delete stops.
2. **Delete the database rows in one transaction**: the report records, the
   users that point at the target, then the target itself. Foreign keys cascade
   from there to apexes, cooperatives, submissions and everything attached to a
   submission. Any error rolls the whole transaction back.
3. **Remove the stored files and report PDFs** of the deleted submissions
   (best effort: a file that cannot be removed is logged).
4. **Remove the users, groups and organization from Keycloak.** An item Keycloak
   no longer has counts as removed. If something cannot be removed, the call
   says the database is clean and the delete can be run again to finish.

Because the database goes first, a failed delete never leaves logins removed
while the data stays behind (the old behaviour).

## Why migration 64

`financial_statements`, `members`, `savings_accounts`, `loans`,
`fixed_deposits`, `computed_kpis` and `abnormality_flags` pointed at a
cooperative with `NO ACTION`. The same rows are also removed through the
cooperative's submissions, but PostgreSQL checked the `NO ACTION` key while
they still existed and refused the delete. Any cooperative with a financial
statement, and every apex and federation above it, could not be deleted from
the database. Migration 64 makes those keys cascade.

## The preview

`GET .../delete-preview` also returns `submissions`, counted from the database
with the same lookup the delete uses.

## Testing

- `tests/hierarchy_delete.rs`: order of operations, rollback, Keycloak failure
  and "already gone" handling, with a recording mock database and a fake Keycloak.
- `tests/hierarchy_delete_real_db.rs`: opt-in. Deletes in a real PostgreSQL and
  checks no row is left in any table. Use a throwaway copy, never a live database:

```bash
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/copy \
HD_KIND=federation HD_ID=<keycloak id> \
  cargo test --test hierarchy_delete_real_db -- --ignored --nocapture
```

## Deploying

`scripts/deploy.sh` applies migration 64 before the new backend rolls out. It
only changes how seven keys behave on delete. Items that were half-deleted
before it (logins gone, rows still present) are not repaired by it: delete them
again after the deploy, or clean them up with a backup in place.
