# Contributing

Development commands are in the [README](README.md#development). Pull requests run CI (lint, typecheck, unit and E2E tests, site build) and the docs drift check described below.

## Documentation

Documentation is part of the change that makes it necessary, not a follow-up.

### When a change needs a documentation update

The threshold is not the size of a change but whether it alters something a document states. A change needs a documentation update when it changes:

- **what users can do or observe:** supported formats and protections, flows, messages, result file names (README, landing page, SUPPORT)
- **security and anti-misuse guarantees** or how they are enforced (README Guardrails, SECURITY)
- **what data goes where:** OAuth scopes, contacted hosts, CSP, storage (SECURITY, PRIVACY)
- **how to build, configure, deploy or verify** unpassword (README, SETUP)
- **the bundled third-party components** (THIRD_PARTY_NOTICES)

It does not need one for refactors, tests, styling, tooling or dependency updates that leave all of the above unchanged.

Privacy policy, terms and imprint are legal texts: changes to them are proposed in a pull request and approved by the maintainer, never published unreviewed.

### How it is enforced

[`scripts/docs-drift.mjs`](scripts/docs-drift.mjs) maps code areas to the documents that describe them (`RULES`). When a change touches such an area without touching one of its documents, the check fails and names the rule, the files and the documents to update. Then either update the documentation, or declare that the change does not alter what those documents describe:

```
Docs-Impact: none – <reason>
```

as a commit message trailer or in the pull request description. A reason is required. The check only makes sure the decision is taken explicitly; whether it is right is decided in review.

- **CI:** the *Docs drift* workflow runs on every pull request, and again when its description is edited.
- **Claude Code:** a `PreToolUse` hook in [`.claude/settings.json`](.claude/settings.json) blocks `git push` and pull request creation while drift is open, so the agent updates the documentation within the same change. At push time there is no pull request description yet, so an opt-out has to be a commit trailer.

Keep the map current: a new code area or document gets a rule. A rule that mostly produces opt-outs is too broad and should be narrowed (the `dependencies` rule, for example, fires only when runtime dependencies are added or removed, not on version bumps).

### Publishing

The documentation site deploys automatically when `docs/`, `site/` or `design/` change on `main`. The web app under `/app/` is always built from the latest release tag. While `main` contains app changes that are not released yet, the automatic deployment is skipped, so the site never describes an app that is not deployed; the documentation then goes live with the next release tag. Details are in the [setup guide](docs/SETUP.md#5-deploy-the-site-and-the-web-app).
