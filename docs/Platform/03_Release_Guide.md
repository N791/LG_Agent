# Release & Version Management

This project strictly follows **Semantic Versioning** and automates the release process using **Changesets** and GitHub Actions.

## 1. Version Strategy

Developers should never manually modify `package.json` versions.
Instead, when you make a change, generate a changeset:

```bash
pnpm changeset
```

Follow the prompts to select the packages affected and the type of change (patch, minor, major). Commit the generated markdown file along with your code.

## 2. Automated Release Pipeline

When a Pull Request is merged into the `main` branch, the `Release Pipeline` triggers:

1. It aggregates all unreleased `.changeset` markdown files.
2. It creates a new "Release Pull Request" named `chore(release): version packages`.
3. When you merge this Release PR:
   - The versions in `package.json` are permanently bumped.
   - A Git Tag (e.g., `v1.2.0`) is pushed to the repository.
   - A GitHub Release is drafted with the auto-generated changelog.
   - The `Docker Build & Push` workflow triggers to build the new tag.

## 3. Docker Tagging Strategy

Every release automatically generates multiple tags for traceability and rollback:

- `latest`
- `vX.Y.Z` (e.g., `v1.2.0`)
- `Git SHA` (e.g., `3fa2b8c`)

## 4. Rollback Strategy

If a catastrophic failure occurs in production:

1. **Infrastructure Rollback**: Execute `helm rollback lg-agent 0` to revert the Kubernetes deployment to the previous stable revision.
2. **Code Rollback**: Since we tag every release, you can revert the Git repository to the previous stable tag and optionally issue a hotfix via changesets.
