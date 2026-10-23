# Changelog

All notable changes of `csp-infra-mongo` are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Each change is recorded in the pull request that introduces it.

## [Unreleased]

### Changed

- `ci.yml` replaces the stub of the executor with the real `csp-catalog-db`, cloned at the branch the pull request targets, and adds a step that migrates the
  instance with it as `catalog_migrator` and checks that `catalog_app` then reads and writes, cannot create an index, and that `worker_app` reads the outbox
  (ADR-049, TD-042).

## [3.0.0] - 2026-10-22

### Added

- README: backup and restore of the whole instance (Annex J.5.4). `mongodump --oplog` of the instance, so the logins and
  roles travel with the data, and a restore in two passes (logins and roles first, then data and oplog), rehearsed on a
  disposable instance. `*.archive` is git-ignored.
- `CHANGELOG.md`.
- The single MongoDB instance of the platform (code-corhuila/csp-infra-mongo#1): `mongo:7.0.14` as a single-node replica
  set `rs0` in every environment, one volume per environment, the key file written from `MONGO_KEYFILE`, no published port
  and the external `platform` network. `compose.yml` includes the executor of `csp-catalog-db`.
- `mongo/init/01-instance.js`: the login users `catalog_app` (`dbOwner` on `catalog_db`) and `worker_app` (no role), with
  the passwords of the environment. It runs once on an empty volume and can be run again by hand (Annex J.5.2 and J.5.5).
- `env/dev.env.example`, `env/qa.env.example` and `env/main.env.example`, one `COMPOSE_PROJECT_NAME` each (`csp-dev`,
  `csp-qa`, `csp-main`), with names and placeholders only (Annex J.5.1).
- `scripts/up.sh` and `scripts/down.sh`, which take the environment as an argument; `down.sh` keeps the volume.
- `.github/workflows/ci.yml`: starts the instance from an empty volume and checks the replica set, the unpublished port,
  the users and the second run of the init script.

### Changed

- README, init script, `compose.yml` and `scripts/up.sh` describe only what exists: `catalog_outbox_reader` is created and
  granted by the changesets of `csp-catalog-db` when it migrates (it is not part of this repository), "waits for PRIMARY"
  becomes "waits until it is healthy", and the promotion branch is `qa-promote/...` (ADR-021).
- The owner of `catalog_db` is the new login `catalog_migrator` (`CATALOG_DB_USER`, used by the executor of `csp-catalog-db`);
  `catalog_app`, the login of `csp-catalog-api`, is created with no role, and its `catalog_writer` role comes from the
  changesets of `csp-catalog-db`. New variable `CATALOG_APP_PASSWORD`; README: how to switch an existing environment, with
  the owner role removed from `catalog_app` as the last step. `ci.yml` checks that `catalog_app` can neither read nor write
  before the role is granted.

### Fixed

- The init script leaves an existing user as it is, and the key file hint is printed on one line
  (code-corhuila/csp-infra-mongo#2).
