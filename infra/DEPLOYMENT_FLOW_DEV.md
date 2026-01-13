# Dev Deployment Flow (EC2 + S3 + GitHub Actions)

This repo deploys **dev** with:
- **Backend** → single EC2 (systemd)
- **Web Passenger** → EC2 (Next.js, `next start`, systemd)
- **Web Admin** → S3 static hosting
- **Web Driver** → S3 static hosting

## 1) One-time infra provisioning (Terraform)
- Terraform lives in `infra/terraform/environments/dev/`.
- Apply and note the outputs:
  - `bootstrap_instance_id`
  - `bootstrap_s3_bucket`
  - `frontend_admin_bucket_name`
  - `frontend_driver_bucket_name`
  - `github_actions_deploy_role_arn`

## 2) EC2 prerequisites (one-time)
On the bootstrap EC2:
- Install scripts:
  - `/usr/local/bin/ssm-deploy` from `infra/ec2/ssm-deploy`
  - `/usr/local/bin/ssm-rollback` from `infra/ec2/ssm-rollback`
- Install systemd units from `infra/ec2/systemd/` and enable:
  - `d2-backend.service`
  - `d2-web-passenger.service`

Artifacts are deployed under:
- `/opt/d2/apps/backend/current`
- `/opt/d2/apps/web_passenger/current`

## 3) Secure environment variables (recommended)
Runtime env vars are pulled from **SSM Parameter Store** during deploy.

On the EC2 deploy, `ssm-deploy` reads parameters under:
- Prefix: `/mern-bootstrap` (default; configurable by `SSM_PARAMETER_PREFIX` on the instance)

Parameters (SecureString recommended):
- `/mern-bootstrap/backend.env`  -> written to `/etc/d2/backend.env`
- `/mern-bootstrap/web_passenger.env` -> written to `/etc/d2/web_passenger.env`

Example (run from a secure workstation, not CI):
- `aws ssm put-parameter --name /mern-bootstrap/backend.env --type SecureString --value "$(cat backend.env)" --overwrite`

## 4) CI/CD (GitHub Actions)
Workflows live in `.github/workflows/`.

### 4.1 Auto deploy on merge to dev
- Workflow: `.github/workflows/deploy-dev.yml`
- Trigger: `push` to `dev` (i.e., merge to dev)

What it does:
1. Builds and typechecks:
   - `backend` (produces `dist/`)
   - `frontend/web_passenger` (produces `.next/`)
2. Packages artifacts via `infra/deploy/package-artifacts.sh`.
3. Uploads artifacts to `s3://$BOOTSTRAP_S3_BUCKET/artifacts/...`.
4. Calls SSM RunCommand on the EC2 instance to run `ssm-deploy`.
5. Builds + syncs static sites:
   - `frontend/web_admin/dist` -> admin S3 bucket
   - `frontend/web_driver/out` -> driver S3 bucket

### 4.2 Security workflow
- `.github/workflows/security-scan.yml`
  - Gitleaks (secret scan)
  - `npm audit` (dependency scan)
  - Trivy filesystem scan

## 5) Required GitHub Environment variables (Environment: dev)
Configure these as **GitHub Environment variables** (Settings → Environments → dev → Variables):
- `AWS_REGION`
- `AWS_ROLE_TO_ASSUME` (Terraform output: `github_actions_deploy_role_arn`)
- `BOOTSTRAP_INSTANCE_ID` (Terraform output)
- `BOOTSTRAP_S3_BUCKET` (Terraform output)
- `FRONTEND_ADMIN_BUCKET_NAME` (Terraform output)
- `FRONTEND_DRIVER_BUCKET_NAME` (Terraform output)

Optional (static frontend API URLs):
- `WEB_ADMIN_API_BASE_URL` (e.g. `http://<EC2_PUBLIC_IP>:3000/api/v1`)
- `WEB_DRIVER_API_BASE_URL` (e.g. `http://<EC2_PUBLIC_IP>:3000/api/v1`)

## 6) Rollback
From AWS SSM RunCommand or an SSH/SSM session on EC2:
- `sudo /usr/local/bin/ssm-rollback backend web_passenger`

