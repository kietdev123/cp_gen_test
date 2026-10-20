# Agent instructions

- Read this file before making changes in this repository.
- For application changes, increase the app's patch version at most once per uncommitted change batch. Compare `package.json` with `HEAD`: if the working version is already higher than the committed version, keep it and add the new work to that same version; do not bump again until the prior batch has been committed. If no uncommitted app-version bump exists, increment the patch version once. Keep `package.json` and the root package entry in `package-lock.json` in sync. Do not bump for documentation-only changes. Respect an explicitly requested version.
- Do not change dependency versions when only bumping the app version.
- Preserve historical build reports; update current setup instructions when artifact names change.
- Treat the version in `package.json` as the source of truth; do not hard-code the current version in these instructions.
- Before operating Themis, read [docs/THEMIS_GUIDE.md](docs/THEMIS_GUIDE.md), especially **Quy trình thao tác nhanh đã kiểm chứng trên máy này**. Inspect the current score table first; reuse an already loaded task/contestant and saved I/O configuration, and only reload or reconfigure what is missing or changed.

## Documentation maintenance

- `docs/USER_GUIDE.md` is shown inside the app. For every user-visible feature or workflow change, update it in the same task so it describes the current UI and behavior.
- `docs/RELEASE_NOTES.md` is shown in the app as **Ghi chú phát hành**. When a task changes app behavior or user-facing content, update the entry for the current app version. Keep notes grouped by the exact versions recorded in `package.json` history; while a change batch is uncommitted, append to its existing version entry instead of creating a new version entry. Use `git log`/`git show` to summarize committed user impact and record the exact commit timestamp in Asia/Saigon (UTC+07:00). For uncommitted work, use the current local timestamp and label it as an update time. Do not invent missing version entries, release dates, or claims that a build was published. Preserve prior entries.
- Update other files under `docs/` when setup, testing, or technical behavior changes make them inaccurate. Keep documentation in Vietnamese, consistent with the app UI.
- When adding or renaming either in-app document, verify the renderer import and navigation still resolve to the corresponding file under `docs/`.
