# unpassword

Overview, layout and commands: [README.md](README.md).

## Documentation

Update documentation in the same change as the code it describes. The threshold and the code-to-document map are in [CONTRIBUTING.md](CONTRIBUTING.md#documentation) and `scripts/docs-drift.mjs`. A `PreToolUse` hook blocks `git push` and PR creation while drift is open. If a change really does not alter what the named documents state, add `Docs-Impact: none – <reason>` as a commit trailer instead of editing documents for the sake of the check. Never edit `docs/PRIVACY.md`, `docs/TERMS.md` or `docs/IMPRINT.md` without saying so explicitly in the PR description: they are legal texts the maintainer approves.
