# Governance and branches

[Tiếng Việt](../vi/governance.md)

MeetScribe uses GitHub Flow. `main` is the only permanent branch and the default branch. Open short-lived `feat/<topic>`, `fix/<topic>`, `docs/<topic>` or `chore/<topic>` branches from current main; urgent fixes use `hotfix/<topic>` and follow the same checks. Open a pull request into main, pass CI, resolve review threads, then squash merge. Merged remote topic branches are automatically deleted. No placeholder branches or permanent develop/release branches are required. Stable releases use annotated `vX.Y.Z` tags.

## Access

| Role | Permissions |
| --- | --- |
| Public contributor | Read, fork, file issues and submit PRs; no push access |
| Trusted maintainer (when appointed) | Write topic branches, review/merge compliant PRs; cannot bypass main checks |
| Owner `@b-ai-iot` | Repository administration and stable-tag creation; review-only PR bypass described below |
| GitHub Actions | Read by default; contents write only for release publishing; cannot approve PRs |

No collaborators are added automatically. A personal-account repository does not offer organization teams/custom roles; the owner assigns the least required access individually. CODEOWNERS currently routes all changes to `@b-ai-iot`; update it when more maintainers join.

## Enforced rules

The main guardrail ruleset has **no bypass actors**: PR required, latest-main `verify` check from GitHub Actions required, conversations resolved, linear history, no force pushes or branch deletion. Squash is the only enabled merge method.

A separate review ruleset requires one approval, CODEOWNER review and dismissal of stale approvals. Repository administrators may bypass **only this review ruleset and only through a pull request**, allowing the sole owner to merge their own PR after CI. They cannot bypass the mandatory main guardrails. This exception is not independent human review; tighten it when a second maintainer is available. Administrators can edit repository policy itself, as with any owner-managed repository.

Tag rules restrict `v*` creation to repository administrators and forbid tag updates/deletion without bypass. Immutable releases additionally lock published assets and tags. Do not reuse a published version; fix errors with a new patch release.

See [release procedure](releasing.md), [contributing](../../CONTRIBUTING.md) and [GitHub rulesets](https://github.com/b-ai-iot/MeetScribe/settings/rules). Repository settings are the source of truth; these rules are applied through the GitHub API, not automatically by cloning this repository.

Ruleset definitions are versioned in [`.github/rulesets/`](../../.github/rulesets/). Changes to these files require a separate administrator API/settings update.
