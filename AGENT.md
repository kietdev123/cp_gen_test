# Agent instructions

- Read this file before making changes in this repository.
- For each task that changes application code, increase the app's patch version once (for example, `1.0.0` to `1.0.1`). Keep `package.json` and the root package entry in `package-lock.json` in sync. Respect an explicitly requested version.
- Do not change dependency versions when only bumping the app version.
- Preserve historical build reports; update current setup instructions when artifact names change.
- Treat the version in `package.json` as the source of truth; do not hard-code the current version in these instructions.

## Documentation maintenance

- `docs/USER_GUIDE.md` is shown inside the app. For every user-visible feature or workflow change, update it in the same task so it describes the current UI and behavior.
- `docs/RELEASE_NOTES.md` is shown in the app as **Ghi chú phát hành**. When a task changes app behavior or user-facing content, update the entry for the current app version. Keep notes grouped by the exact versions recorded in `package.json` history; use `git log`/`git show` to summarize user impact and record the exact commit timestamp in Asia/Saigon (UTC+07:00). For uncommitted work, use the current local timestamp and label it as an update time. Do not invent missing version entries, release dates, or claims that a build was published. Preserve prior entries.
- Update other files under `docs/` when setup, testing, or technical behavior changes make them inaccurate. Keep documentation in Vietnamese, consistent with the app UI.
- When adding or renaming either in-app document, verify the renderer import and navigation still resolve to the corresponding file under `docs/`.
