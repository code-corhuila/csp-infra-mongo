## What changes and why
<!-- One paragraph. The reviewer reads this before the diff. -->


## User story (required)
<!-- A base scaffold pull request (structure only) writes:
     "Not applicable: base scaffold, structure only". Otherwise: "Refs: code-corhuila/csp-docs#NN". -->
Refs:


## How it was tested
- Local validation:
- `ci.yml` result:


## Size
<!-- Run: git diff --numstat origin/develop...HEAD -->
Added: · Deleted: · Total:  (limit 400, excluding tests and generated files)


## Promotion trail (only for pull requests into `qa` or `main`)
<!-- List the original commits this pull request re-applies.
     Every commit must carry the line "(cherry picked from commit <sha>)". -->
-


## Checklist
- [ ] Meets the acceptance criteria of the user story (or is a base scaffold, not applicable)
- [ ] Local validation passes
- [ ] Under 400 changed lines, excluding tests and generated files
- [ ] Title follows Conventional Commits
- [ ] No secrets in code, `env/*.example` or workflows
- [ ] No collection, validator or migration in this repository: they belong to each `-db`
- [ ] Into `qa` or `main`: every commit was re-applied with `git cherry-pick -x`
