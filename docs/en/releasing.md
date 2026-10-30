# Releasing

[Tiếng Việt](../vi/releasing.md) · [Governance](governance.md)

Releases follow stable SemVer (`vMAJOR.MINOR.PATCH`): patch for compatible fixes, minor for compatible features, major for incompatible changes. `v1.3.0` is the first packaged GitHub release; older changelog entries describe source history.

1. Create `chore/release-X.Y.Z` from current main. Update `package.json`, both versions in `package-lock.json`, `extension/manifest.json`, `extension/model.mjs`, version examples and both changelogs. Use `npm install --package-lock-only` when appropriate. Include dated bilingual release notes.
2. Run `npm ci`, `npm run docs:check`, `npm test`, `python3 -m unittest discover -s tests -p 'test_release.py'`, browser/extension/language suites, then `npm run package`. The CI workflow documents browser setup. Validate with `python3 tools/release.py --tag vX.Y.Z --notes release-notes.md` (temporary notes need not be committed).
3. Open a PR into main, review the result and wait for required `verify`. Squash merge; the owner may use the documented review-only bypass while there is one maintainer. Never bypass PR or CI.
4. Fetch main and select its verified release commit. Create and push an annotated tag as repository administrator:
   ```sh
   git fetch origin main --tags
   git switch main
   git pull --ff-only origin main
   git tag -a vX.Y.Z -m "MeetScribe vX.Y.Z"
   git push origin vX.Y.Z
   ```
5. The Release workflow verifies version parity and main ancestry, runs the complete reusable CI, downloads its ZIP/checksum artifact, verifies SHA-256 and creates bilingual notes. It uploads to a draft before publishing. Only the publish job has `contents: write`; fork PRs never receive publishing credentials.
6. Check the workflow, release page and downloaded files. The release must contain `MeetScribe-X.Y.Z.zip` and `SHA256SUMS.txt`; GitHub also offers source archives. Extract the ZIP and load its `MeetScribe/` directory in Chrome. Confirm the published release is immutable.

ZIP entry timestamps and permissions are fixed so repeated packaging of identical source on the same Python/zlib toolchain produces identical bytes. Cross-toolchain compression differences are possible. Checksums detect a changed download; they are not a maintainer signature.

## Verify a download

Download both files from the [same release](https://github.com/b-ai-iot/MeetScribe/releases/latest), then in that folder:

```sh
# Linux
sha256sum --check SHA256SUMS.txt
# macOS
shasum -a 256 -c SHA256SUMS.txt
```

On Windows PowerShell, run `Get-FileHash .\MeetScribe-1.3.0.zip -Algorithm SHA256` and compare its hash with `SHA256SUMS.txt`.

## Recovery

A failure before publishing can leave a draft. Fix transient infrastructure problems and rerun the failed workflow; it can replace draft assets, then publish. A rerun preserves an already published release. Inspect drafts and assets before retrying. Code defects require a new PR, version and tag; protected tags and immutable published assets cannot be overwritten. Never delete/recreate a published release as a repair method.

The version guard deliberately rejects prerelease tags. Add a reviewed prerelease policy before introducing release candidates. No Chrome Web Store publication or signing key is configured.
