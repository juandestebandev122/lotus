# Database

This folder explains where the database is, because it is not where most
people look for it.

## There is no database server

The application does not use MySQL, PostgreSQL, MongoDB or any other database
service. The entire database is **one JSON file**:

```
.data/db.json
```

It is loaded into memory when the application starts and written back to disk
whenever something changes (debounced, written to a temporary file and
atomically renamed, so a crash can never leave it half-written). One server
runs everything, and there is nothing to install, connect to, or configure.

This is why the source code contains no connection string, no ORM, no
`migrations/` folder and no SQL. Those things exist to talk to a separate
database process, and there isn't one.

## What is in the source code

| Where | What |
|---|---|
| `src/server/db.ts` | The database engine: the full schema (`DBShape`, about 90 collections), loading, saving, integrity checks, automatic snapshots, and every one-time migration |
| `src/server/repo.ts` | Every read and write the application performs, as functions. Nothing else touches the file |
| `docs/DATABASE-SCHEMA.md` | Every collection, grouped, with what each one holds |
| `src/app/admin/backup-restore/` | The admin page that lists snapshots and restores one |

In a conventional project the equivalent of this folder would be
`schema.sql` or `schema.prisma`. Here the schema is a TypeScript interface,
and the engine that enforces it is in the same file.

## What is NOT in the source code, and why

The **data** — the actual users, rooms, coins, messages — is deliberately not
in the source archive. Data is not code. It contains every user's personal
details and password hashes, and a source archive is the kind of file that
gets copied and forwarded.

The complete live database is delivered **separately**, as its own file
alongside the source archive:

```
database-backup-YYYY-MM-DD.json.gz
```

Unzip it and you have `db.json`. Restore it with the steps in
`docs/SETUP.md` (section 6) or `docs/04-backup-and-restore.md`.

## Running with no data at all

If `.data/db.json` does not exist when the application starts, it creates one
and seeds a default administrator account. So the source archive alone runs
from a clean checkout; you only need the backup file to bring the real users
across.

## Rules

1. Never edit `db.json` while the application is running. It holds the
   database in memory and will overwrite your change within a second, and it
   will look as though your edit worked. Stop the process, edit, start.
2. Back up before every deploy: `cp .data/db.json /root/db-before-deploy.json`.
3. Copy a backup off the server weekly. The automatic snapshots in
   `.data/backups/` are on the same disk as the database and protect against
   mistakes, not against losing the machine.
