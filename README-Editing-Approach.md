# Editing Approach

Rules for how Claude Code edits files in this project.

---

## 1. Always use native file tools — never shell commands

All file reads and edits must use the built-in Read and Edit tools directly.

Never use Python, Node.js, `node -e`, `sed`, `awk`, `echo >`, or any shell command to read or modify files. This includes `.ts`, `.tsx`, `.js`, `.json`, and all other file types.

If a pattern match fails during an edit, re-read the file with the Read tool to get the exact characters (including indentation), then retry with the Edit tool.

---

## 2. Share approach and get confirmation before making edits

Before making any code change, state clearly:

- What file(s) will be changed
- What the change is and why
- Any risks or side effects

Wait for explicit confirmation ("yes", "go ahead", "do it") before proceeding. Do not start editing based on implied approval.

---

## 3. Never touch lock files or mission-critical files without explicit approval

The following files must never be edited without first explaining the exact change, why it is necessary, and getting explicit sign-off:

- `package-lock.json`
- `package.json` (root or any workspace)
- Any Supabase migration file (`supabase/migrations/*.sql`) that has already been run in production
- CI/CD configuration files
- Environment files (`.env`, `.env.production`, `.env.development`)

If a change to one of these files seems necessary, stop — explain the situation, propose the specific change, and wait for approval.

---

## 4. Verify before claiming something is correct

Before stating that a commit, file, or approach is correct:

- Check the git log to confirm dates and what actually changed
- Check which files a commit touched with `git show --stat`
- Do not guess or rely on memory — read the actual state

---

## 5. Never commit or push unless explicitly asked

Do not commit or push changes unless the user explicitly says to commit or push. Do not suggest it either. Wait to be asked.

---

## 6. When something breaks, diagnose before fixing

Do not attempt fixes in a loop. If a deployment fails:

1. Read the full error message
2. Identify the root cause
3. Propose one specific fix
4. Get confirmation before applying it

If unsure of the root cause, say so explicitly rather than guessing and making changes.

## 7. Make sure not to break any exiting functionality unless it's clearly nessary for an improvement.
