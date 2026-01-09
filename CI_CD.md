# CI/CD (Phase 0: Single EC2)

## Repo setup (mono-repo)
This system is already a mono-repo (backend + 3 frontends + infra). Keep it mono-repo for Phase 0:
- One PR can update API + frontends + infra safely together.
- Shared CI standards (lint/build/scans) and one deployment orchestration.
- Lower operational overhead than coordinating multiple repos/releases.

If you later split repos, keep this pipeline design and convert each job’s `working-directory` to the new repo paths.

## Branching strategy
- `feature/*` branches
- Open PRs into `dev`
- Merge to `dev` triggers CI gates + automatic deploy to the `dev` environment

(Recommended next step for Phase 1: promote `dev` → `main` for production with manual approvals.)

## CI/CD architecture

### CI (dev)
Workflow: `.github/workflows/ci-dev.yml`

Triggers:
- `pull_request` to `dev`
- `push` to `dev`

Actions performed on merge to `dev` (and on PRs):
- Backend
  - `npm ci`
  - `npm run lint`
  - `npm run build`
  - `npm test` (Node built-in smoke tests)
  - `npm audit --audit-level=high`
- Web Admin
  - `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm audit --audit-level=high`
- Web Driver / Web Passenger
  - `npm ci`, `npm run lint`, `npm run build`, `npm audit --audit-level=high`
- Secret scanning
  - `gitleaks` using `.gitleaks.toml`
- Dependency vulnerability scanning
  - `trivy fs` scanning the repo for HIGH/CRITICAL vulnerabilities in lockfiles

### Deploy (dev)
Workflow: `.github/workflows/deploy-dev.yml`

Trigger:
- Runs automatically after `CI (dev)` succeeds on the `dev` branch (`workflow_run`).

High-level flow:
1. Build backend + all frontends.
2. Package artifacts (tar.gz) per component.
3. Upload artifacts to GitHub Actions artifacts and to S3 (deploy bucket).
4. Use AWS OIDC to assume a deployment role.
5. Use SSM Run Command to execute `/usr/local/bin/ssm-deploy` on the EC2 instance.

Why SSM (instead of SSH keys):
- No long-lived SSH secrets in GitHub.
- Auditable commands via SSM.
- Works well with least-privilege IAM.

## Build artifacts
Artifacts are created by `infra/deploy/package-artifacts.sh`:
- Backend: `backend-<sha>.tgz` (includes `dist/`, `package*.json`, migrations)
- Web Admin: `web_admin-<sha>.tgz` (includes `dist/`) — deployed to S3
- Web Driver: `web_driver-<sha>.tgz` (includes `.next/`, `public/`, `package*.json`, `next.config.mjs`) — deployed to EC2
- Web Passenger: `web_passenger-<sha>.tgz` (same layout as web driver) — deployed to EC2

## Deployment strategy justification (Phase 0)
- Web Admin is a Vite SPA and is deployed as a static site to S3 (Phase 0 simplicity; CloudFront can be added later).
- Web Driver and Web Passenger are Next.js and are deployed to EC2 as Node services (keeps SSR/runtime compatibility).

## EC2 deploy/rollback implementation

### Deploy script
Source: `infra/ec2/ssm-deploy`

Expected install location on EC2:
- `/usr/local/bin/ssm-deploy`

What it does:
- Downloads artifacts from S3 into `/tmp`.
- Extracts to versioned release directories:
  - `/opt/d2/apps/<app>/releases/<release_id>`
- Updates symlinks:
  - `/opt/d2/apps/<app>/current`
  - `/opt/d2/apps/<app>/previous`
- Installs production dependencies for Node services (`npm ci --omit=dev`).
- Restarts systemd services.

### Rollback script
Source: `infra/ec2/ssm-rollback`

Expected install location:
- `/usr/local/bin/ssm-rollback`

Rollback mechanism:
- Switches `/opt/d2/apps/<app>/current` back to `/opt/d2/apps/<app>/previous`.
- Restarts services.

## Systemd units
- Backend systemd unit: `infra/ec2/systemd/d2-backend.service`
- Web Driver unit: `infra/ec2/systemd/d2-web-driver.service`
- Web Passenger unit: `infra/ec2/systemd/d2-web-passenger.service`

These reference env files (not committed):
- `/etc/d2/backend.env`
- `/etc/d2/web_driver.env`
- `/etc/d2/web_passenger.env`

## Environment-specific configuration
- GitHub Actions:
  - Store env-specific values as GitHub secrets (repo-level or GitHub Environments if you enable approvals).
- EC2:
  - Store runtime secrets in `/etc/d2/*.env` with strict permissions (`chmod 600`).

## Least-privilege IAM (minimum)

### GitHub Actions deploy role (assumed via OIDC)
Allow:
- `s3:PutObject` to `s3://<DEPLOY_BUCKET>/artifacts/dev/*`
- `ssm:SendCommand`, `ssm:GetCommandInvocation`, `ssm:ListCommands`
- `ec2:DescribeInstances` (only if resolving by tags)

### EC2 instance profile role
Allow:
- `s3:GetObject` for the same artifact prefix
- SSM Managed Instance core permissions (AWS managed policy `AmazonSSMManagedInstanceCore`)

## Validation checklist

### GitHub
- Create branch `dev` and protect it (require PRs + required status checks).
- Ensure `CI (dev)` is a required check for merging to `dev`.
- Create GitHub Environment `dev` and add secrets:
  - `AWS_ROLE_ARN`
  - `AWS_REGION`
  - `DEPLOY_S3_BUCKET`
  - `WEB_ADMIN_S3_BUCKET`
  - Either `EC2_INSTANCE_ID` OR (`EC2_TAG_PROJECT` and `EC2_TAG_ENVIRONMENT`)

### AWS
- Configure GitHub OIDC provider in AWS IAM.
- Create an IAM role for GitHub Actions with least-privilege policies.
- Ensure EC2 is registered to SSM (SSM agent installed + instance profile attached).
- Ensure EC2 instance profile can `s3:GetObject` from the deploy bucket prefix.

### EC2 host
- Install deploy tools:
  - `sudo install -m 0755 infra/ec2/ssm-deploy /usr/local/bin/ssm-deploy`
  - `sudo install -m 0755 infra/ec2/ssm-rollback /usr/local/bin/ssm-rollback`
- Install systemd units:
  - `sudo install -m 0644 infra/ec2/systemd/*.service /etc/systemd/system/`
  - `sudo systemctl daemon-reload`
  - `sudo systemctl enable --now d2-backend d2-web-driver d2-web-passenger`

### Functional
- `CI (dev)` succeeds on PRs to `dev`.
- Merging to `dev` triggers `Deploy (dev)`.
- Post-deploy checks:
  - Backend: `GET /health` returns `{ ok: true }`
  - Admin UI loads from the S3 website endpoint
  - Driver/Passenger apps start and can authenticate against backend

### Rollback drill
- Trigger `ssm-rollback` via SSM (or run locally on the instance) and confirm service recovers.
