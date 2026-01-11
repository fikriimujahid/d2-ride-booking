# CI/CD Complete Flow (Step-by-Step)

This document explains **exactly how the entire CI/CD system works** from infrastructure provisioning to code deployment.

---

## Phase 1: Infrastructure Bootstrap (One-Time Setup)

### Step 1.1: Provision AWS Infrastructure with Terraform

**Location**: `infra/terraform/environments/dev/`

**What happens**:
```bash
cd infra/terraform/environments/dev
terraform init
terraform plan
terraform apply
```

**Terraform creates**:
1. **VPC + Networking**
   - VPC with public subnet
   - Internet Gateway
   - Route tables

2. **EC2 Instance** (your single Phase 0 server)
   - Amazon Linux 2023
   - Elastic IP attached
   - Security group (ports 22/80/443/3000)
   - Instance profile with SSM permissions

3. **S3 Buckets**
   - Bootstrap bucket: `d2-dev-<account-id>-bootstrap` (for build artifacts)
   - Web Admin bucket: `d2-dev-admin-<random>` (for static site hosting)

4. **IAM Roles**
   - EC2 instance role: Can read artifacts from S3, has SSM managed instance permissions
   - GitHub Actions deploy role: Can upload to S3, trigger SSM commands (via OIDC, no secrets)

5. **Cognito User Pool** (for authentication)

**Output from Terraform** (save these values):
```
bootstrap_instance_id       = "i-0abc123..."
bootstrap_elastic_ip        = "54.123.45.67"
bootstrap_s3_bucket         = "d2-dev-123456789012-bootstrap"
github_actions_deploy_role_arn = "arn:aws:iam::123456789012:role/d2-dev-github-actions-deploy"
frontend_admin_bucket_name  = "d2-dev-admin-abc123"
frontend_admin_website_url  = "http://d2-dev-admin-abc123.s3-website-us-east-1.amazonaws.com"
```

---

### Step 1.2: Prepare the EC2 Instance

**Connect to EC2** (via AWS Session Manager or SSH):
```bash
# Option 1: AWS Session Manager (no SSH key needed)
aws ssm start-session --target i-0abc123...

# Option 2: SSH (if you enabled SSH in Terraform)
ssh -i your-key.pem ec2-user@54.123.45.67
```

**Bootstrap prerequisites (automatic via Terraform `user_data`)**:

Terraform provisions the EC2 instance with these already installed/configured:
- Docker engine enabled and started
- Docker Compose v2 installed (as a Docker CLI plugin)
- Node.js 20 + npm
- AWS CLI + git + curl
- SSM Agent started (for Session Manager and Run Command)
- `ec2-user` added to the `docker` group (log out/in to take effect)

This runbook installs the repo’s deployment scripts and service units as manual steps below.

**Verify `user_data` installed everything**:
```bash
# 1) cloud-init status (user_data runs via cloud-init)
sudo cloud-init status --wait

# 2) cloud-init output log (best place to debug failures)
sudo tail -n 200 /var/log/cloud-init-output.log

# 3) Verify tools/services
sudo systemctl status docker --no-pager
sudo docker version
sudo docker compose version
node --version
npm --version

# 4) Marker file created by user_data
cat /home/ec2-user/bootstrap-user-data-status.txt
```

Manual steps start below (repo clone, DB init, env files, services).

**Install PostgreSQL 18** (required for backend database):
```bash
# Docker + Docker Compose are installed by Terraform user_data on the bootstrap EC2 instance.

# Verify Docker + Compose are available
sudo docker version
sudo docker compose version

# Clone the repository (so you can use docker-compose.yml)
cd /home/ec2-user

# If the repo is PUBLIC:
git clone https://github.com/fikriimujahid/d2-ride-booking

# If the repo is PRIVATE, pick ONE option:
#
# Option A (recommended): SSH deploy key (read-only)
# 1) Create an SSH key on EC2
#    ssh-keygen -t ed25519 -f /home/ec2-user/.ssh/d2_repo -N ""
# 2) Add the public key as a Deploy Key in GitHub:
#    Repo → Settings → Deploy keys → Add deploy key (read-only)
# 3) Clone using that key:
#    GIT_SSH_COMMAND='ssh -i /home/ec2-user/.ssh/d2_repo -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new' \
#      git clone git@github.com:fikriimujahid/d2-ride-booking.git
#
# Option B: HTTPS + fine-scoped PAT (read-only)
# - Create a PAT with minimal scopes (GitHub: fine-grained token → Repository contents: Read)
# - Then clone (NOTE: token will appear in shell history if you paste it):
#   git clone https://<TOKEN>@github.com/fikriimujahid/d2-ride-booking.git

cd d2-ride-booking
# Fetch all branches from origin
git fetch origin

# Switch to dev branch
git checkout dev

# Create .env for docker compose (used by docker-compose.yml)
cat > .env <<'EOF'
POSTGRES_PASSWORD=CHANGE_ME_SECURE_PASSWORD
POSTGRES_DB=ride_booking
POSTGRES_USER=postgres
EOF

# If you previously started postgres with different env vars, the named volume keeps the old roles.
# Reset postgres data (DELETES DATABASE DATA) if needed:
#   sudo docker compose down -v

# Start only postgres (and redis if you want it)
sudo docker compose --env-file .env up -d postgres

# Verify PostgreSQL is running
sudo docker ps --filter name=ridebooking-postgres
sudo docker exec ridebooking-postgres psql -U postgres -d ride_booking -c "SELECT version();"

```

**Configure PostgreSQL** (create database and user):
```bash
# With Docker Compose, the database/user are created from .env:
#   POSTGRES_DB=ride_booking
#   POSTGRES_USER=postgres
#   POSTGRES_PASSWORD=CHANGE_ME_SECURE_PASSWORD

echo "✅ PostgreSQL database 'ride_booking' created with user 'postgres'"
```

**Configure PostgreSQL to allow password authentication**:
```bash
# PostgreSQL Docker image is already configured for password auth.
# Because we bind to 127.0.0.1 only ("-p 127.0.0.1:5432:5432"), it is not exposed publicly.

echo "✅ PostgreSQL configured for password authentication"
```

**Test database connection**:
```bash
# Test connection
sudo docker exec ridebooking-postgres psql -U postgres -d ride_booking -c "SELECT version();"

# If successful, you should see PostgreSQL version info
```

**Clone the repository onto EC2** (so you can access the scripts):
```bash
# Already done above for Docker Compose.
```

**Install the deployment scripts**:
```bash
# Copy deploy and rollback scripts to system path
sudo install -m 0755 infra/ec2/ssm-deploy /usr/local/bin/ssm-deploy
sudo install -m 0755 infra/ec2/ssm-rollback /usr/local/bin/ssm-rollback

# Verify they're executable
which ssm-deploy     # Should output: /usr/local/bin/ssm-deploy
which ssm-rollback   # Should output: /usr/local/bin/ssm-rollback
```

**Install systemd service units**:
```bash
# Copy systemd units
sudo cp infra/ec2/systemd/d2-backend.service /etc/systemd/system/
sudo cp infra/ec2/systemd/d2-web-driver.service /etc/systemd/system/
sudo cp infra/ec2/systemd/d2-web-passenger.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services (start on boot)
sudo systemctl enable d2-backend.service
sudo systemctl enable d2-web-driver.service
sudo systemctl enable d2-web-passenger.service

# Don't start yet (no code deployed), just verify units are valid
sudo systemctl status d2-backend.service
```

**Create environment config files** (runtime secrets):
```bash
# Create config directory
sudo mkdir -p /etc/d2
sudo chmod 755 /etc/d2

# Backend env file
sudo tee /etc/d2/backend.env > /dev/null <<'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://postgres:CHANGE_ME_SECURE_PASSWORD@localhost:5432/ride_booking
JWT_ISSUER=d2-ride-booking
JWT_AUD_ADMIN=admin-web
JWT_AUD_DRIVER=driver-app
JWT_AUD_PASSENGER=passenger-app
JWT_ALG=EdDSA
JWT_KEY_ID=auth-2026-01
JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
TOTP_ENC_KEY_BASE64=your-base64-encoded-32-byte-key
LOG_LEVEL=info
EOF

# Generate production keys (JWT + TOTP)
#
# The backend requires:
# - TOTP_ENC_KEY_BASE64: 32 random bytes, base64-encoded
# - If JWT_ALG=EdDSA: Ed25519 private/public key pair in PEM
#
# 1) Generate the TOTP encryption key (32 bytes, base64)
#    Copy the output into TOTP_ENC_KEY_BASE64
#
#    openssl rand -base64 32
#
# 2) Generate an Ed25519 key pair for JWT signing
#
#    openssl genpkey -algorithm ed25519 -out jwt_ed25519_private.pem
#    openssl pkey -in jwt_ed25519_private.pem -pubout -out jwt_ed25519_public.pem
#
# 3) Convert PEM files into single-line env values with literal \n sequences
#    Copy the printed values into JWT_PRIVATE_KEY_PEM and JWT_PUBLIC_KEY_PEM
#
#    python3 - <<'PY'
# from pathlib import Path
# priv = Path('jwt_ed25519_private.pem').read_text().strip().replace('\n', '\\n')
# pub = Path('jwt_ed25519_public.pem').read_text().strip().replace('\n', '\\n')
# print(f'JWT_PRIVATE_KEY_PEM="{priv}"')
# print(f'JWT_PUBLIC_KEY_PEM="{pub}"')
# PY

# If you must use symmetric signing instead (NOT recommended):
#   JWT_ALG=HS256
#   JWT_SECRET=<generate a long random string>

# Web Driver env file
sudo tee /etc/d2/web_driver.env > /dev/null <<'EOF'
NODE_ENV=production
# Driver app calls the auth API directly from the browser.
# This MUST be set at build time (NEXT_PUBLIC_*).
NEXT_PUBLIC_AUTH_API_BASE_URL=http://54.123.45.67:3000
# Server-side calls (Next.js route handlers / SSR)
AUTH_API_BASE_URL=http://127.0.0.1:3000
EOF

# Web Passenger env file
sudo tee /etc/d2/web_passenger.env > /dev/null <<'EOF'
NODE_ENV=production
# Passenger app uses Next.js API routes ("BFF") like /api/auth/login.
# Those server routes call the backend auth API using AUTH_API_BASE_URL.
AUTH_API_BASE_URL=http://127.0.0.1:3000

# IMPORTANT (HTTP vs HTTPS):
# In production, the passenger app sets httpOnly auth cookies.
# If you serve the passenger site over plain HTTP (no TLS) and NODE_ENV=production,
# Secure cookies will NOT be stored by the browser and login will not stick.
# For HTTP-only setups, set COOKIE_SECURE=false. For real production, use HTTPS and remove this.
COOKIE_SECURE=false
EOF

# Secure the files (readable only by root)
sudo chmod 600 /etc/d2/*.env
```

**Create app directories** (where releases will be deployed):
```bash
sudo mkdir -p /opt/d2/apps/{backend,web_driver,web_passenger}
sudo chown -R ec2-user:ec2-user /opt/d2
```

**Run database migrations** (after first deployment):
```bash
# After the first deployment completes, you'll need to run migrations
# SSH to EC2 and run:

# Load runtime env (DATABASE_URL, etc). This file is root-only (chmod 600).
sudo bash -lc 'set -a; source /etc/d2/backend.env; set +a; cd /opt/d2/apps/backend/current; npm run migrate'

# This will create the initial database schema
```

✅ **EC2 is now ready to receive deployments**

---

## Phase 2: GitHub Setup (One-Time)

### Step 2.1: Configure GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

**Add these secrets**:
```
AWS_ROLE_ARN             = arn:aws:iam::123456789012:role/d2-dev-github-actions-deploy
AWS_REGION               = us-east-1
DEPLOY_S3_BUCKET         = d2-dev-123456789012-bootstrap
WEB_ADMIN_S3_BUCKET      = d2-dev-admin-abc123
EC2_INSTANCE_ID          = i-0abc123...
```

(Alternatively: use `EC2_TAG_PROJECT=d2` and `EC2_TAG_ENVIRONMENT=dev` instead of `EC2_INSTANCE_ID`)

---

### Step 2.2: Create and Protect the `dev` Branch

```bash
# Locally, create dev branch
git checkout -b dev
git push -u origin dev
```

**On GitHub**:
1. Go to Settings → Branches → Add branch protection rule
2. Branch name pattern: `dev`
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - Select required check: `CI (dev)`
4. Save

✅ **GitHub is now configured**

---

## Phase 3: Developer Workflow (Daily Work)

### Step 3.1: Developer Creates a Feature Branch

```bash
git checkout dev
git pull
git checkout -b feature/add-new-endpoint
```

Developer writes code, commits:
```bash
# Make changes to api/auth-api/src/...
git add .
git commit -m "feat: add new user endpoint"
git push -u origin feature/add-new-endpoint
```

---

### Step 3.2: Developer Opens a Pull Request to `dev`

1. On GitHub: Click "Compare & pull request"
2. Base branch: `dev` ← compare: `feature/add-new-endpoint`
3. Click "Create pull request"

**GitHub Actions IMMEDIATELY triggers CI workflow** (`.github/workflows/ci-dev.yml`)

---

## Phase 4: CI Pipeline Executes (Automated)

**Workflow file**: `.github/workflows/ci-dev.yml`

**Trigger**: `pull_request` targeting `dev` OR `push` to `dev`

### What Happens (in parallel jobs):

#### Job 1: Secret Scan
```bash
# Uses gitleaks with .gitleaks.toml config
gitleaks detect --source . --config .gitleaks.toml
```
- Scans all files for hardcoded secrets
- ❌ Fails if any secrets found

#### Job 2: Dependency Vulnerability Scan
```bash
# Uses Trivy to scan for HIGH/CRITICAL vulnerabilities
trivy fs . --severity HIGH,CRITICAL --exit-code 1
```
- Scans package-lock.json, pnpm-lock.yaml, etc.
- ❌ Fails if HIGH/CRITICAL vulnerabilities found

#### Job 3: Backend Checks
```bash
cd api/auth-api
npm ci
npm run lint      # Runs eslint/tsc checks
npm run build     # Compiles TypeScript to dist/
npm test          # Runs smoke.test.mjs (health + openapi endpoints)
npm audit --audit-level=high
```
- ❌ Fails if any step fails

#### Job 4: Web Admin Checks
```bash
cd frontend/web_admin
npm ci
npm run lint
npm run typecheck  # TypeScript validation
npm test          # Vitest unit tests
npm run build     # Vite production build → dist/
npm audit --audit-level=high
```

#### Job 5: Web Driver Checks
```bash
cd frontend/web_driver
npm ci
npm run lint
npm run build     # Next.js build → .next/
npm audit --audit-level=high
```

#### Job 6: Web Passenger Checks
```bash
cd frontend/web_passenger
npm ci
npm run lint
npm run build     # Next.js build → .next/
npm audit --audit-level=high
```

**Result**:
- ✅ All jobs pass → PR shows green checkmark, can be merged
- ❌ Any job fails → PR blocked, developer must fix

---

### Step 3.3: Developer Merges PR

Once CI is green and PR is approved:
1. Click "Merge pull request" on GitHub
2. Confirm merge to `dev`

**This merge triggers the deployment pipeline immediately**

---

## Phase 5: Deployment Pipeline Executes (Automated)

**Workflow file**: `.github/workflows/deploy-dev.yml`

**Trigger**: `workflow_run` (runs after "CI (dev)" completes successfully on `dev` branch)

### Step 5.1: Build Job

**Checkout code at the exact commit that was merged**:
```bash
git checkout <merge_commit_sha>
```

**Build all components**:
```bash
# Backend
cd api/auth-api
npm ci
npm run build        # Creates dist/ folder

# Web Admin
cd frontend/web_admin
npm ci
npm run build        # Creates dist/ folder

# Web Driver
cd frontend/web_driver
npm ci
npm run build        # Creates .next/ folder

# Web Passenger
cd frontend/web_passenger
npm ci
npm run build        # Creates .next/ folder
```

**Package artifacts**:
```bash
# Runs infra/deploy/package-artifacts.sh
# Creates these tarballs:
artifacts/backend-<sha>.tgz          # Contains: dist/, package*.json, migrations/
artifacts/web_admin-<sha>.tgz        # Contains: dist/
artifacts/web_driver-<sha>.tgz       # Contains: .next/, public/, package*.json, next.config.mjs
artifacts/web_passenger-<sha>.tgz    # Contains: .next/, public/, package*.json, next.config.mjs
```

**Upload to GitHub Actions artifacts** (for download by deploy job):
```bash
# Uploads all *.tgz files as workflow artifacts
```

---

### Step 5.2: Deploy Job

**Download artifacts from build job**:
```bash
# Downloads all *.tgz files to artifacts/ folder
```

**Configure AWS credentials** (via OIDC, no secrets stored):
```bash
# GitHub Actions exchanges OIDC token for temporary AWS credentials
# Assumes role: arn:aws:iam::123456789012:role/d2-dev-github-actions-deploy
```

**Upload backend/driver/passenger artifacts to S3**:
```bash
aws s3 cp artifacts/backend-<sha>.tgz \
  s3://d2-dev-123456789012-bootstrap/artifacts/dev/<sha>/backend.tgz

aws s3 cp artifacts/web_driver-<sha>.tgz \
  s3://d2-dev-123456789012-bootstrap/artifacts/dev/<sha>/web_driver.tgz

aws s3 cp artifacts/web_passenger-<sha>.tgz \
  s3://d2-dev-123456789012-bootstrap/artifacts/dev/<sha>/web_passenger.tgz
```

**Deploy Web Admin to S3 static website**:
```bash
# Extract web_admin-<sha>.tgz
tar -xzf artifacts/web_admin-<sha>.tgz -C web_admin_unpack

# Sync dist/ to S3 website bucket (deletes old files)
aws s3 sync web_admin_unpack/dist/ s3://d2-dev-admin-abc123/ --delete
```

✅ **Web Admin is now live at**: `http://d2-dev-admin-abc123.s3-website-us-east-1.amazonaws.com`

**Resolve EC2 instance ID**:
```bash
# Either uses EC2_INSTANCE_ID secret directly, or
# Queries EC2 API for instance with tags: project=d2, environment=dev
aws ec2 describe-instances --filters "Name=tag:project,Values=d2" ...
```

**Deploy backend/driver/passenger to EC2 via SSM**:
```bash
# GitHub Actions sends SSM Run Command to EC2:
aws ssm send-command \
  --instance-ids i-0abc123... \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["sudo /usr/local/bin/ssm-deploy d2-dev-123456789012-bootstrap <sha> artifacts/dev/<sha>/backend.tgz artifacts/dev/<sha>/web_driver.tgz artifacts/dev/<sha>/web_passenger.tgz"]}'
```

**This triggers the `ssm-deploy` script on EC2** ⬇️

---

## Phase 6: What Happens on EC2 During Deploy

**Script running**: `/usr/local/bin/ssm-deploy` (installed in Step 1.2)

### Step 6.1: Download Artifacts from S3

```bash
# On EC2, script runs:
aws s3 cp s3://d2-dev-123456789012-bootstrap/artifacts/dev/<sha>/backend.tgz \
  /tmp/d2-deploy-<sha>/backend.tgz

aws s3 cp s3://d2-dev-123456789012-bootstrap/artifacts/dev/<sha>/web_driver.tgz \
  /tmp/d2-deploy-<sha>/web_driver.tgz

aws s3 cp s3://d2-dev-123456789012-bootstrap/artifacts/dev/<sha>/web_passenger.tgz \
  /tmp/d2-deploy-<sha>/web_passenger.tgz
```

---

### Step 6.2: Extract to Release Directories

```bash
# Extract backend
mkdir -p /opt/d2/apps/backend/releases/<sha>
tar -xzf /tmp/d2-deploy-<sha>/backend.tgz \
  -C /opt/d2/apps/backend/releases/<sha>

# Extract web_driver
mkdir -p /opt/d2/apps/web_driver/releases/<sha>
tar -xzf /tmp/d2-deploy-<sha>/web_driver.tgz \
  -C /opt/d2/apps/web_driver/releases/<sha>

# Extract web_passenger
mkdir -p /opt/d2/apps/web_passenger/releases/<sha>
tar -xzf /tmp/d2-deploy-<sha>/web_passenger.tgz \
  -C /opt/d2/apps/web_passenger/releases/<sha>
```

**File structure on EC2 now looks like**:
```
/opt/d2/apps/
├── backend/
│   ├── current -> releases/abc123     (old symlink)
│   ├── previous -> releases/xyz789    (older symlink)
│   └── releases/
│       ├── abc123/                    (old release)
│       ├── xyz789/                    (older release)
│       └── <new-sha>/                 (NEW release just extracted)
│           ├── dist/
│           ├── package.json
│           └── migrations/
├── web_driver/
│   ├── current -> releases/abc123
│   ├── previous -> releases/xyz789
│   └── releases/
│       └── <new-sha>/
│           ├── .next/
│           ├── public/
│           └── package.json
└── web_passenger/
    └── (same structure)
```

---

### Step 6.3: Update Symlinks

```bash
# For each app (backend, web_driver, web_passenger):

# 1. Save current as previous
ln -sfn /opt/d2/apps/backend/releases/abc123 \
  /opt/d2/apps/backend/previous

# 2. Point current to new release
ln -sfn /opt/d2/apps/backend/releases/<new-sha> \
  /opt/d2/apps/backend/current
```

**After symlink update**:
```
/opt/d2/apps/backend/
├── current -> releases/<new-sha>    ✅ NOW POINTS TO NEW CODE
├── previous -> releases/abc123      ✅ SAVED FOR ROLLBACK
└── releases/
    ├── abc123/
    ├── xyz789/
    └── <new-sha>/
```

---

### Step 6.4: Install Production Dependencies

```bash
# For each app, run npm ci inside the current/ directory:
cd /opt/d2/apps/backend/current
npm ci --omit=dev --no-audit --no-fund

cd /opt/d2/apps/web_driver/current
npm ci --omit=dev --no-audit --no-fund

cd /opt/d2/apps/web_passenger/current
npm ci --omit=dev --no-audit --no-fund
```

This installs `node_modules/` inside each release folder.

---

### Step 6.5: Restart Services

```bash
sudo systemctl daemon-reload
sudo systemctl restart d2-backend.service
sudo systemctl restart d2-web-driver.service
sudo systemctl restart d2-web-passenger.service
```

**What each service does**:
- `d2-backend.service`: Runs `node /opt/d2/apps/backend/current/dist/server.js` (Fastify API on port 3000)
- `d2-web-driver.service`: Runs `next start` from `/opt/d2/apps/web_driver/current` (on port 3001)
- `d2-web-passenger.service`: Runs `next start` from `/opt/d2/apps/web_passenger/current` (on port 3002)

✅ **New code is now LIVE on EC2**

---

### Step 6.6: GitHub Actions Waits for Completion

```bash
# Back in GitHub Actions, the workflow waits for SSM command to finish:
aws ssm wait command-executed --command-id <cmd-id>

# Then fetches the output:
aws ssm get-command-invocation --command-id <cmd-id>
```

**If deploy succeeded**:
- ✅ Workflow shows green
- EC2 is serving new code

**If deploy failed**:
- ❌ Workflow shows red
- Admin can check SSM output logs
- Can run rollback (see Phase 7)

---

## Phase 7: Rollback (Manual, When Needed)

### When to Rollback
- Deploy succeeded but app has bugs in production
- Services won't start with new code
- Database migration failed

### How to Trigger Rollback

**Option 1: Via AWS Console SSM Run Command**
1. Go to AWS Console → Systems Manager → Run Command
2. Click "Run command"
3. Select document: `AWS-RunShellScript`
4. Target instances: `i-0abc123...`
5. Command:
   ```bash
   sudo /usr/local/bin/ssm-rollback
   ```
6. Click "Run"

**Option 2: Via AWS CLI**
```bash
aws ssm send-command \
  --instance-ids i-0abc123... \
  --document-name "AWS-RunShellScript" \
  --parameters commands="sudo /usr/local/bin/ssm-rollback"
```

**Option 3: SSH into EC2 and run manually**
```bash
ssh ec2-user@54.123.45.67
sudo /usr/local/bin/ssm-rollback
```

---

### What Happens During Rollback

**Script**: `/usr/local/bin/ssm-rollback`

```bash
# For each app (backend, web_driver, web_passenger):

# 1. Read the previous symlink
previous_release=$(readlink -f /opt/d2/apps/backend/previous)
# e.g., /opt/d2/apps/backend/releases/abc123

# 2. Point current back to previous
ln -sfn $previous_release /opt/d2/apps/backend/current

# 3. Restart service
sudo systemctl restart d2-backend.service
```

✅ **App is now running the previous working version**

---

## Summary: Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: ONE-TIME SETUP                                         │
├─────────────────────────────────────────────────────────────────┤
│ 1. terraform apply → Creates EC2, S3, IAM roles                 │
│ 2. SSH to EC2 → Install ssm-deploy, ssm-rollback, systemd units│
│ 3. GitHub → Add secrets (AWS_ROLE_ARN, EC2_INSTANCE_ID, etc.)  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: DAILY DEVELOPMENT WORKFLOW                             │
├─────────────────────────────────────────────────────────────────┤
│ 1. Developer creates feature branch                             │
│ 2. Developer opens PR to dev                                    │
│    → Triggers CI workflow (.github/workflows/ci-dev.yml)        │
│       ├─ Secret scan (gitleaks)                                 │
│       ├─ Dependency scan (trivy)                                │
│       ├─ Backend: lint, build, test, audit                      │
│       ├─ Web Admin: lint, typecheck, test, build, audit         │
│       ├─ Web Driver: lint, build, audit                         │
│       └─ Web Passenger: lint, build, audit                      │
│    ✅ All pass → PR can be merged                               │
│ 3. Developer merges PR                                          │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: AUTOMATED DEPLOYMENT                                   │
├─────────────────────────────────────────────────────────────────┤
│ Merge to dev → Triggers deploy workflow (deploy-dev.yml)        │
│                                                                  │
│ BUILD JOB:                                                       │
│ 1. npm run build (backend, web_admin, web_driver, web_passenger)│
│ 2. Package into .tgz files                                      │
│ 3. Upload to GitHub Actions artifacts                           │
│                                                                  │
│ DEPLOY JOB:                                                      │
│ 4. Download artifacts                                            │
│ 5. Upload backend/driver/passenger .tgz to S3 artifacts bucket  │
│ 6. Deploy web_admin: aws s3 sync dist/ to admin S3 bucket       │
│    ✅ Admin site now live                                        │
│ 7. Send SSM command to EC2: run /usr/local/bin/ssm-deploy       │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: ON EC2 (ssm-deploy script runs)                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. Download .tgz files from S3 to /tmp                          │
│ 2. Extract to /opt/d2/apps/<app>/releases/<sha>                 │
│ 3. Update symlinks:                                              │
│    - previous → old current                                      │
│    - current → new release                                       │
│ 4. npm ci --omit=dev (install node_modules)                     │
│ 5. systemctl restart d2-backend.service                         │
│    systemctl restart d2-web-driver.service                      │
│    systemctl restart d2-web-passenger.service                   │
│    ✅ New code is LIVE                                           │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: ROLLBACK (if needed, manual trigger)                   │
├─────────────────────────────────────────────────────────────────┤
│ Admin runs: sudo /usr/local/bin/ssm-rollback                    │
│ 1. Reads previous symlink                                        │
│ 2. Points current → previous                                     │
│ 3. Restarts services                                             │
│    ✅ Back to previous working version                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| File | Purpose | Where it Runs |
|------|---------|---------------|
| `.github/workflows/ci-dev.yml` | Run tests/scans on PRs | GitHub Actions |
| `.github/workflows/deploy-dev.yml` | Build + deploy after merge | GitHub Actions |
| `infra/deploy/package-artifacts.sh` | Package code into .tgz files | GitHub Actions |
| `infra/ec2/ssm-deploy` | Deploy new release on EC2 | **EC2 (installed at /usr/local/bin/)** |
| `infra/ec2/ssm-rollback` | Rollback to previous release | **EC2 (installed at /usr/local/bin/)** |
| `infra/ec2/systemd/*.service` | Run backend/driver/passenger as services | **EC2 (/etc/systemd/system/)** |
| `/etc/d2/*.env` | Runtime secrets | **EC2 (not in git)** |

---

## Frequently Asked Questions

### Q: Why are ssm-deploy and ssm-rollback in `/usr/local/bin/` instead of the repo path?

**A**: The SSM Run Command executes on the EC2 instance, not inside your repo. The scripts must be installed to a system PATH location so they can be called from anywhere. You copy them once during EC2 setup (Step 1.2).

### Q: When do I need to update ssm-deploy on EC2?

**A**: Only when you modify the deployment logic itself (e.g., change how symlinks work, add new apps). For normal code changes, you don't touch the scripts—they just download and deploy whatever artifacts GitHub Actions provides.

### Q: What if I make a typo in ssm-deploy and need to fix it?

**A**: 
1. Fix the script in `infra/ec2/ssm-deploy` in your repo
2. SSH to EC2 (or use SSM Session Manager)
3. Re-run: `sudo install -m 0755 /path/to/repo/infra/ec2/ssm-deploy /usr/local/bin/ssm-deploy`

### Q: Can I test deploy locally before pushing to dev?

**A**: Yes, you can:
1. Build artifacts: `infra/deploy/package-artifacts.sh /tmp/artifacts local`
2. Upload to S3 manually
3. SSH to EC2 and run: `sudo /usr/local/bin/ssm-deploy <bucket> local <backend_key> <driver_key> <passenger_key>`

### Q: How do I see what's currently deployed on EC2?
### Q: Where is the PostgreSQL database?

**A**: For Phase 0, PostgreSQL runs directly on the EC2 instance at `localhost:5432`. 

**For production**, consider using AWS RDS instead:
1. Uncomment the RDS module in `infra/terraform/environments/dev/main.tf`
2. Run `terraform apply`
3. Update `/etc/d2/backend.env` with the RDS endpoint instead of `localhost`

**Pros of RDS**: Automated backups, multi-AZ high availability, managed updates, point-in-time recovery  
**Cons of RDS**: Additional cost (~$15-30/month for t4g.micro)

**Note**: PostgreSQL 18 is the latest version. If using RDS, select PostgreSQL 18.x when creating the database instance.

### Q: How do I run database migrations?

**A**: After deploying new code with schema changes:

```bash
# SSH to EC2
ssh ec2-user@54.123.45.67

# Run migrations from the current release
cd /opt/d2/apps/backend/current
npm run migrate
```

Or automate it by adding this to the `ssm-deploy` script after the symlink update (before service restart).

### Q: How do I backup the PostgreSQL database?

**A**: 
```bash
# Create a backup
sudo docker exec -t ridebooking-postgres pg_dump -U postgres -d ride_booking > /tmp/ride_booking-backup-$(date +%Y%m%d).sql

# Restore from backup
cat /tmp/ride_booking-backup-20260109.sql | sudo docker exec -i ridebooking-postgres psql -U postgres -d ride_booking
```

For automated backups, consider setting up a cron job or using AWS RDS automated backups.

---

This document was generated on January 9
readlink /opt/d2/apps/backend/current
# Shows: /opt/d2/apps/backend/releases/abc123...

# Or check systemd service status:
sudo systemctl status d2-backend.service
```

---

This document was generated on January 8, 2026 for the D2 Ride Booking CI/CD system.

Backend (most likely source of INTERNAL_ERROR)

Check service status: sudo systemctl status d2-backend.service --no-pager
Last 200 log lines: sudo journalctl -u d2-backend.service -n 200 --no-pager
Follow logs live while you reproduce: sudo journalctl -fu d2-backend.service
If it’s coming from the web apps

Driver UI: sudo journalctl -u d2-web-driver.service -n 200 --no-pager (or follow with -f)
Passenger UI: sudo journalctl -u d2-web-passenger.service -n 200 --no-pager
Database / Docker logs (if backend errors mention DB)

Postgres container logs: sudo docker logs ridebooking-postgres --tail 200
If you run redis too: sudo docker ps then sudo docker logs <redis-container> --tail 200