// Instance setup of the single MongoDB of the environment (Annex J.5.2 and J.5.5). The image runs it only when the
// volume is empty, and it can be run again by hand when a domain is added: every statement checks before it writes,
// and an existing user is left as it is, like the PostgreSQL init (Annex J.7).
// The roles of each domain (catalog_outbox_reader...), the collections and the validators are created by its -db
// repository; here only the login users exist, with the passwords of the environment (Annex B, rule 5).
// The passwords come from the environment of the container and are never part of a command text.
const catalogDb = process.env.CATALOG_DB_NAME || 'catalog_db';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error('missing ' + name);
  }
  return value;
}

function ensureUser(databaseName, user, password, roles) {
  const target = db.getSiblingDB(databaseName);
  if (target.getUser(user) === null) {
    target.createUser({ user: user, pwd: password, roles: roles });
  }
}

// The catalog domain owns catalog_db and nothing else (ADR-006): its executor creates the collections, the
// validators and the roles with this user, and csp-catalog-api reads and writes with it.
ensureUser(catalogDb, required('CATALOG_DB_USER'), required('CATALOG_DB_PASSWORD'), [
  { role: 'dbOwner', db: catalogDb },
]);

// The relay of the outbox (ADR-019) logs in with this user. It starts with no role: csp-catalog-db grants it
// catalog_outbox_reader, which lists find on catalog_db.outbox_event and nothing else.
ensureUser(catalogDb, 'worker_app', required('WORKER_APP_PASSWORD'), []);
