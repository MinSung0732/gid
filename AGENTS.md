# Repository agent instructions

## Luna Chat Coder entry point

When repository development is requested from a chat surface with a disposable sandboxed code-execution environment, read `.agents/skills/luna-chat-coder/SKILL.md` before working on the repository task.

Loading the skill is a readiness step, not a reason to use GitHub Actions. Normal engineering work should stay in the chat sandbox work container when it is available and sufficient.

Treat exact GitHub commit and PR state as durable source truth, preserve unrelated work, and do not make access to the user's computer a dependency of the workflow.

## Project

This repository is the `gyeolideun-minigame` web project. It uses plain HTML/CSS/JavaScript and Node.js scripts without an application-framework dependency.

Important paths include:

- `index.html`: main entry page
- `src/`: shared application/game source
- `games/`: individual minigames
- `public/`: static assets
- `scripts/`: local server and automated checks

## Required engineering workflow

- Never make development changes directly on `main` unless the user explicitly asks for that exact operation.
- Start work from the latest intended base state and use a task-specific branch.
- Before editing, inspect the relevant existing implementation and preserve unrelated work.
- Prefer the repository's existing architecture, naming, and browser-compatible plain JavaScript style rather than introducing a framework or new dependency without a concrete need.
- Do not commit secrets, credentials, local `.env` values, or machine-specific files.
- For functional changes, update or add tests when the existing test structure reasonably covers the behavior.

## Project Harmony patch records

- For work under `games/harmony/`, every user-visible behavior, content, balance, or presentation patch must update `games/harmony/CHANGELOG.md` in the same task or PR before the work is considered complete.
- This requirement includes `feat` and `fix` work and material changes to cards, monsters, statuses, rewards, economy, gameplay rules, UI behavior, audio/VFX behavior, persistence, authentication, or cloud behavior.
- Follow the version policy already defined in `games/harmony/CHANGELOG.md`: use a version section for a large patch and a dated `Unversioned Updates` entry for a smaller patch.
- Record each material user-visible effect clearly enough that a later maintainer can reconstruct what changed. Do not replace specific patch notes with a generic line such as "misc fixes".
- Pure `refactor`, `test`, `ci`, `chore`, or documentation-only work may omit a CHANGELOG entry only when it does not change user-visible behavior. If a task mixes internal work with any user-visible change, the CHANGELOG update is mandatory.
- Commit messages must identify the actual change. Placeholder or meaningless messages such as `123`, `x`, or a bare `fix` are not allowed.
- Before opening or updating a Harmony PR, explicitly verify whether `games/harmony/CHANGELOG.md` must change. The PR description must state either that the CHANGELOG was updated or why the change is exempt.
- A user-visible Harmony patch with a required but missing CHANGELOG entry is incomplete: do not declare it complete, ready to merge, or fully verified until the record is added.

## Verification

For source changes, run the applicable checks before declaring completion:

```sh
npm run check
npm test
```

When runtime behavior needs manual inspection and the environment allows it, the local server is:

```sh
npm start
```

Only report checks that actually ran. If a check cannot run, report the exact blocker instead of claiming success.

## Publication

- Keep changes on the task branch until they are ready for review.
- Before opening or updating a PR, review the final diff and make sure it contains only intended changes.
- PR descriptions should summarize the change, list verification performed, and identify any known limitation or unverified behavior.
- Do not merge a PR unless the user explicitly asks for the merge.
