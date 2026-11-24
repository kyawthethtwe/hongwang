// Commit messages follow Conventional Commits: `type(scope): summary`, e.g. `fix(api): ...`.
// Checked locally by the husky commit-msg hook (.husky/commit-msg) and in CI for pull requests into dev.
export default {
  extends: ['@commitlint/config-conventional'],
};
