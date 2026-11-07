# GEMINI.md — AI AdAstra Web (`AIAstra_WEB`)

Follow [`AGENTS.md`](file:///c:/Users/Owner/Documents/work/AIAstra_Server/AGENTS.md) for all multi-agent collaboration, branch hygiene (`develop` `--no-ff`), worktree retirement (`git worktree remove <literal-path>` and `git branch -d <branch>` immediately after merge), and UI/UX assistant rules.

## Mandatory Rule: Environment-Driven Selections & Feature Flags
All configurable selections, feature flags (`VITE_AREA_BOARD_ENABLED`, `VITE_LIFE_READING_ENABLED`, `VITE_LUCKY_TIMES_ENABLED`), API base URLs, and runtime thresholds must be read from environment variables with clean defaults rather than hardcoded in component logic.

## Deploying `develop` via `release-candidate-staging` & GitHub Actions
Once `tsc --noEmit` (`npm run build -- --mode staging` or typecheck) and tests pass on `develop`, Gemini agents are authorized to push `develop`, merge `develop` `--no-ff` into `release-candidate-staging` (preserving `.github/workflows/deploy-staging-amplify.yml`), and push `release-candidate-staging` (with `gh auth switch --user sachinm`) to trigger the GitHub Actions OIDC Amplify deployment (`d20sdo476h9w6c`).
