# Credentials, Secrets, Tokens, and CI Security Policy

## 1. Purpose

This document defines how contributors and CI/CD workflows must handle credentials, repository tokens, API keys, secrets, and privileged operations. The goal is to prevent accidental credential exposure and ensure that automation operates with the minimum permissions required.

## 2. Never Commit Secrets

Contributors **must not commit or push** the following to the repository:

* API keys
* Passwords
* Access tokens
* Personal access tokens (PATs)
* Cloud-provider credentials
* Database credentials
* Private keys or certificates
* Session cookies
* OAuth client secrets
* `.env` files containing real credentials
* CI/CD secrets or deployment credentials

Use environment variables or the repository's supported secret-management mechanism instead.

Example:

```env
API_KEY=your-secret-value
DATABASE_URL=your-database-url
```

The actual values must remain local or be stored in the appropriate secret store.

### Recommended practice

Commit a safe template such as:

```text
.env.example
```

with placeholder values:

```env
API_KEY=
DATABASE_URL=
```

Never use real production credentials in examples, documentation, tests, or sample configuration.

## 3. Repository Tokens

Repository and platform tokens must be treated as sensitive credentials.

Contributors should:

* Use personal tokens only when required.
* Request the smallest required scope.
* Avoid sharing tokens through issues, pull requests, chat, screenshots, or commits.
* Never place tokens directly in source code.
* Revoke tokens immediately if they are exposed.
* Prefer short-lived or fine-grained tokens where supported.

A token should provide **only the permissions required for the task**.

For example, a workflow that only needs to read repository contents should not receive write or administrative permissions.

## 4. CI/CD Secrets

Secrets required by GitHub Actions or another CI provider must be stored using the platform's encrypted secret mechanism.

Workflows should reference secrets through environment variables rather than embedding them directly:

```yaml
env:
  API_KEY: ${{ secrets.API_KEY }}
```

Do not print secrets in workflow logs:

```yaml
# ❌ Never do this
run: echo "${{ secrets.API_KEY }}"
```

Avoid commands that may accidentally expose environment variables or credentials in logs.

## 5. Least-Privilege Automation

Every workflow must follow the **principle of least privilege**.

A workflow should receive only the permissions it actually needs.

Prefer explicitly declaring permissions:

```yaml
permissions:
  contents: read
```

rather than relying on broad default permissions.

If a workflow needs to create a release, comment on a pull request, modify repository contents, or perform another privileged action, grant only the specific permission required.

Example:

```yaml
permissions:
  contents: read
  pull-requests: write
```

Do not grant administrative or write access merely because it is convenient.

## 6. Pull Requests From Forks

Workflows triggered by pull requests from forks must be treated as **untrusted code**.

Contributors must assume that code executed during a pull request may be able to inspect files, environment variables, dependencies, and other resources available to the job.

Therefore:

* Do not expose sensitive secrets to untrusted pull-request workflows.
* Avoid running privileged workflows automatically on untrusted code.
* Do not use elevated tokens unnecessarily.
* Separate validation workflows from privileged deployment or release workflows.
* Require maintainer approval before executing workflows that have access to sensitive resources.

Workflows that perform deployments, releases, publishing, or repository writes should run only after the appropriate approval boundary has been satisfied.

## 7. Approval Boundaries

Privileged operations must have an explicit approval boundary.

Examples include:

* Production deployments
* Publishing packages
* Creating releases
* Modifying repository settings
* Rotating credentials
* Accessing production databases
* Writing to protected branches
* Executing scripts with elevated repository permissions

Where supported, use protected environments and required approvals:

```text
Pull Request
     ↓
Automated Tests
     ↓
Maintainer Review
     ↓
Environment Approval
     ↓
Privileged Workflow
     ↓
Deployment / Release
```

A contributor should not be able to bypass review simply by modifying a workflow file in their pull request.

## 8. Workflow Changes Require Review

Changes to CI/CD configuration must be reviewed carefully because workflow files can introduce access to repository secrets or privileged tokens.

Maintainers should pay particular attention to changes involving:

* `.github/workflows/`
* `permissions:`
* `secrets.*`
* deployment configuration
* release automation
* third-party GitHub Actions
* shell commands executed by workflows
* authentication configuration

A workflow change should be considered security-sensitive when it increases the code's ability to access secrets or modify repository resources.

## 9. Third-Party Actions

Use trusted and maintained third-party actions.

Where practical:

* Pin actions to a specific commit SHA.
* Avoid unnecessary third-party actions.
* Review an action before granting it access to secrets or write permissions.
* Keep actions updated through the repository's normal dependency-management process.

Do not introduce an action solely to perform a task that can safely be handled by an existing trusted action or native command.

## 10. Local Development Credentials

Contributors should keep development credentials outside the repository.

Before committing, contributors should verify that credentials have not accidentally been staged:

```bash
git status
git diff --cached
```

## 11. If a Secret Is Accidentally Exposed

If a credential is committed, pushed, logged, or otherwise exposed:

1. **Revoke or rotate it immediately.**
2. Determine where and for how long it was exposed.
3. Remove the secret from the repository and affected logs where possible.
4. Replace it with a newly generated credential.
5. Notify the appropriate maintainer/security contact.
6. Review repository and service logs for suspicious use.

Simply deleting the secret in a later commit is **not sufficient**, because it may remain accessible in Git history or cached artifacts.

## 12. Maintainer Responsibilities

Maintainers should:

* Keep repository permissions as restrictive as practical.
* Configure protected branches and environments for sensitive operations.
* Review changes to CI workflows.
* Regularly audit repository secrets and tokens.
* Remove unused credentials.
* Prefer short-lived and narrowly scoped credentials.
* Ensure production credentials are separated from development credentials.
* Require approval for privileged deployments and releases.

## 13. Contributor Checklist

Before opening a pull request, contributors should verify:

* [ ] No real credentials are committed.
* [ ] Tokens are not present in source code or documentation.
* [ ] CI workflows do not unnecessarily request write permissions.
* [ ] Secrets are not printed in CI logs.
* [ ] Fork-based workflows do not receive unnecessary secrets.
* [ ] New privileged operations have an appropriate approval boundary.
* [ ] CI configuration changes have been reviewed for security implications.

## 14. Core Principle

> **Automation should have exactly the access it needs—no more.**

Credentials must be treated as sensitive, CI workflows must assume that untrusted contributor code may execute, and privileged operations must remain behind appropriate review and approval boundaries.
