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

## Finishing a delete that was only half done

Before this fix, a delete could remove the logins, groups and organization from
Keycloak and leave the database rows behind. Such leftovers are still in the
database (and in the figures built from it) but no longer in Keycloak.

A Keycloak "not found" while reading is treated as "nothing left to remove", so
running the delete again now cleans the database side of such a leftover. Any
other Keycloak failure (unreachable, server error) still stops the delete
before it changes anything.

The federation list in the app is built from Keycloak, so a federation whose
organization is already gone is **not shown** and cannot be deleted from the
screen. Delete it through the API with its Keycloak id:

`DELETE /api/v1/ministry/federations/{keycloak id}` (identity verification
required). The same holds for an apex (`/api/v1/federation/apexes/{id}`) and a
cooperative (`/api/v1/apex/cooperatives/{id}`).

## Deploying

`scripts/deploy.sh` applies migration 64 before the new backend rolls out. It
only changes how seven keys behave on delete. It does not repair leftovers by
itself: finish them as above. On a live server, take a backup first, do one
federation at a time, and check the result (for example with the opt-in
`hierarchy_delete_real_db` test against a restored copy of the backup).
