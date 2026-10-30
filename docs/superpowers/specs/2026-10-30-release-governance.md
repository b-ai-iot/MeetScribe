# Release and repository governance

Use GitHub Flow: protected `main`, short-lived `feat/*`, `fix/*`, `docs/*`, `chore/*`, optionally `hotfix/*`; stable SemVer tags `vX.Y.Z`. Release 1.3.0 is the first packaged GitHub release; previous changelog versions describe source history.

Require pull requests, current successful GitHub Actions `verify`, resolved conversations and linear history on main; block force pushes/deletion without bypass. Require one CODEOWNER approval in a separate rule; repository administrators can bypass only this review rule through a PR because there is one maintainer. Public contributors fork the repo; no new collaborator grants.

Use squash merges, remove merged remote feature branches, read-only Actions defaults and explicit write permission only for publishing. Protect published tags from modification/deletion. Enable immutable releases if supported. Publish a validated extension ZIP, SHA256SUMS.txt and bilingual notes after full CI. Verify matching package/lock/manifest/model versions and that release commits belong to main. Document installation, contribution, privileges and future releases in English and Vietnamese.
