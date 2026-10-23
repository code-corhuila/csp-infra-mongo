# csp-infra-mongo

> The single MongoDB instance of the platform: container, volume, replica set, login users and environments

Part of the **Cinesync Platform** distributed system — team `cinesync-platform`, Group 1.
Governance and documentation live in [`csp-docs`](https://github.com/code-corhuila/csp-docs).

## Purpose

Annex J (J.2, J.3.1 and J.8) gives each engine one infrastructure repository that governs its container and its
volume. This is the one for MongoDB: it **defines the only MongoDB instance** of each environment, as a
**single-node replica set `rs0`** (Annex B, rule 6; ADR-016). Every `-db` repository that uses MongoDB keeps its
migrations and brings only its executor; it defines no database service and no volume. Today that is
`csp-catalog-db`, which owns the database `catalog_db`.

The PostgreSQL instance and the root composition of the platform live in `csp-infra-postgres` (J.8.1).

```
compose.yml                    the mongodb service, its volume, and the include of every -db executor
mongo/init/01-instance.js      login users of the domains; runs once on an empty volume and can be run again
env/<env>.env.example          one file per environment: dev, qa, main (git-ignored without .example)
scripts/up.sh · down.sh        bring an environment up (waits until it is healthy) and stop it, keeping the volume
.github/workflows/ci.yml       starts the instance from an empty volume and checks users, replica set and re-run
```

## Repositories are cloned as siblings

The `include` path of `compose.yml` assumes `csp-catalog-db` is cloned next to this repository. A missing sibling
fails loudly on `up`: nothing is silently skipped.

## Environments

Each environment has its own env file, its own `COMPOSE_PROJECT_NAME` (`csp-dev`, `csp-qa`, `csp-main`), and therefore
its own container and volume (J.5.1). Only the `.example` file is versioned; the real one carries secrets.

```bash
cp env/dev.env.example env/dev.env      # then set the administrator, the key file and the passwords
./scripts/up.sh dev                     # creates the network, starts MongoDB and waits until it is healthy
# from csp-catalog-db, once per environment and again whenever a changeset is added:
docker compose -f ../csp-catalog-db/deploy/compose.yml --env-file ../csp-infra-mongo/env/dev.env \
  --profile tooling run --rm catalog-db-migrate
```

## Users

`mongo/init/01-instance.js` creates the login users from the secrets of the environment. The roles of a domain are
created by its `-db` (Annex B, rule 5), never here.

| User | Database | Roles at creation | Used by |
|---|---|---|---|
| `catalog_migrator` (`CATALOG_DB_USER`) | `catalog_db` | `dbOwner` on `catalog_db` only | the `catalog-db-migrate` executor |
| `catalog_app` | `catalog_db` | none at creation; when `csp-catalog-db` migrates, its changesets create `catalog_writer` (`find`, `insert`, `update` and `remove` on `catalog_db`) and grant it | `csp-catalog-api` |
| `worker_app` | `catalog_db` | none at creation; when `csp-catalog-db` migrates, its changesets create `catalog_outbox_reader` and grant it (ADR-019) | `csp-worker` |

A service never connects with the administrator, and the API never connects with the owner of its database.

### An existing environment: switch to the migrator

The init script runs only on an empty volume and leaves an existing user as it is, so an environment that was created
with `catalog_app` as owner is switched by hand, in this order:

1. Back the instance up (see Backup and restore).
2. In the env file, set `CATALOG_DB_USER=catalog_migrator` with a new `CATALOG_DB_PASSWORD`, and add
   `CATALOG_APP_PASSWORD`, above the lines that use them. `catalog_app` already exists, so it keeps the password it has;
   put that same value in `CATALOG_APP_PASSWORD` so that the file says what the API uses.
3. Recreate the `mongodb` container so that it reads the new variables, and run the init script by hand (the command of
   the rule "The instance is created once"): it creates `catalog_migrator` and leaves `catalog_app` as it is.
4. Run the `catalog-db-migrate` executor, which now logs in as `catalog_migrator`: `catalog-roles-003` and `-004` create
   `catalog_writer` and grant it to `catalog_app`.
5. Check that `csp-catalog-api` and `worker_app` still work.
6. Only then remove the owner role from the API login and write down the result:

   ```bash
   docker compose --env-file env/qa.env exec mongodb sh -c \
     'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.getSiblingDB(\"catalog_db\").revokeRolesFromUser(\"catalog_app\", [{ role: \"dbOwner\", db: \"catalog_db\" }])"'
   ```

## Rules

- **The volume is the history of the system.** In `qa` and `main` never run `docker compose down -v` and never delete
  the volume; back the database up before migrating (J.5.4, see Backup and restore). `down.sh` has no option to remove it.
- **The instance is created once.** The init script runs only when the volume is empty (J.5.2). To add a domain,
  add its user to the script and run it once by hand in every environment that already exists (J.5.5):

  ```bash
  docker compose --env-file env/qa.env exec mongodb sh -c \
    'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --file /docker-entrypoint-initdb.d/01-instance.js'
  ```
- **No secret is versioned.** `env/*.env.example` carries names and placeholders only; the key file of the replica set
  is written into the container at start from `MONGO_KEYFILE`.
- **No port is published.** The instance is reachable only from the `platform` network; services use the name
  `mongodb`, never `localhost`.
- **No collection, validator or migration lives here:** they belong to each `-db` (Norma 5.2.1).

## Backup and restore

Back the whole instance up before every migration in `qa` and `main` (J.5.4). The dump covers every database **and**
the logins and roles, which live in `admin`: it is the equivalent of `pg_dump` plus `pg_dumpall --globals-only` in
`csp-infra-postgres`. Do not use `--db`: it cannot be combined with `--oplog`, and it leaves the logins out.

```bash
docker compose --env-file env/qa.env exec -T mongodb sh -c \
  'mongodump -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --oplog --gzip --archive' \
  > qa-backup.archive
```

The archive goes to the standard output, so nothing is left inside the container. It holds the data and the credential
hashes: keep it outside the repository (`*.archive` is git-ignored) with restricted access. Where it is stored,
encrypted and for how long is set in
[`13-operations/backup-and-recovery.md`](https://github.com/code-corhuila/csp-docs/blob/main/13-operations/backup-and-recovery.md).

To restore, start an **empty** instance with `./scripts/up.sh qa` (the init script creates the logins from the env
file) and restore in two passes:

```bash
R='mongorestore -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --gzip --archive'
docker compose --env-file env/qa.env exec -T mongodb sh -c "$R --drop --nsInclude='admin.*'" < qa-backup.archive
docker compose --env-file env/qa.env exec -T mongodb sh -c "$R --oplogReplay" < qa-backup.archive
```

The first pass restores the logins and roles and `--drop` replaces the ones the init script just created; without it
the roles of the domains (`catalog_outbox_reader`...) do not come back. The second pass restores the data and replays
the oplog. They cannot be one pass: `--oplogReplay` does not accept `--nsInclude`, and a single pass replays the oplog
after replacing the logins and fails with `Unauthorized`. Then check that `catalog_app` and `worker_app` log in and
read, and run the executor of `csp-catalog-db` to confirm that nothing is pending.

Both commands were rehearsed on a disposable instance built from this repository, with data, a domain role and its
grant: after the restore the data, `catalog_app` and `worker_app` with its role were back, and the oplog replayed.

## Branching

Three permanent branches. **None of them accepts a direct commit** — you enter through a child
branch and leave through a Pull Request.

```
develop  <--PR--  feat/... fix/... chore/...
qa       <--PR--  qa-promote/...
main     <--PR--  release/...  hotfix/...
```

Promotion happens **by re-application** (`git cherry-pick -x`), never by merging one permanent
branch into another: `merge develop -> qa` and `merge qa -> main` do not exist in this model.

`main` requires **1 approval from `ariel5253`**. On `develop` and `qa` the team sets its own review
rule.

Full policy: `00-governance/branching-policy.md` in `csp-docs`.
