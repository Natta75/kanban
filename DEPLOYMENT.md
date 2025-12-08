# Deployment Documentation

Complete guide for deploying the Kanban application to production server.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Daily Usage](#daily-usage)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)
- [Security Best Practices](#security-best-practices)
- [Advanced Topics](#advanced-topics)

## Overview

This project uses an automated deployment system that allows you to deploy changes with a single command. The deployment script handles:

- Automatic git commit and push to GitHub
- Server backup creation before deployment
- Code deployment via git pull
- Asset versioning for cache busting
- Nginx reload
- Health checks
- Automatic rollback on failures

**Deployment Time:** 15-25 seconds

## Prerequisites

Before you can deploy, ensure you have:

- **Git** installed locally
- **SSH access** to the production server
- **curl** for health checks
- **Production server details:**
  - Host: 88.218.168.98
  - User: root
  - Application path: `/var/www/kanban.75vibe-coding.ru/`

## Initial Setup

This setup only needs to be done once.

### Step 1: Generate SSH Key

Generate a dedicated SSH key for deployment:

```bash
ssh-keygen -t ed25519 -C "kanban-deploy" -f ~/.ssh/kanban_deploy
```

When prompted:
- Press Enter to skip passphrase (or add one for extra security)
- This creates two files:
  - `~/.ssh/kanban_deploy` (private key - keep secret!)
  - `~/.ssh/kanban_deploy.pub` (public key - safe to share)

### Step 2: Copy SSH Key to Server

Copy the public key to the production server:

```bash
ssh-copy-id -i ~/.ssh/kanban_deploy.pub root@88.218.168.98
```

You'll be prompted to enter the server password. This is the **last time** you'll need to enter it!

### Step 3: Test SSH Connection

Verify passwordless SSH connection works:

```bash
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98 "echo 'SSH key works!'"
```

If successful, you should see "SSH key works!" without being prompted for a password.

### Step 4: Configure Deployment

Create your deployment configuration:

```bash
cd /path/to/kanban
cp deploy.config.example deploy.config
chmod 600 deploy.config
```

The `deploy.config` file should already contain the correct settings for production:

```bash
SSH_USER="root"
SSH_HOST="88.218.168.98"
SSH_KEY="$HOME/.ssh/kanban_deploy"
DEPLOY_PATH="/var/www/kanban.75vibe-coding.ru"
GITHUB_REPO="https://github.com/Natta75/kanban.git"
BACKUP_DIR="/var/www/backups"
KEEP_BACKUPS=5
NGINX_RELOAD=true
APP_URL="https://kanban.75vibe-coding.ru"
```

**Important:** The `deploy.config` file is excluded from git for security. Never commit it!

### Step 5: Server Preparation

Prepare the server for automated deployments:

```bash
# Test connection
ssh root@88.218.168.98

# Check if git is initialized
cd /var/www/kanban.75vibe-coding.ru
git status

# If not initialized, set up git
git init
git remote add origin https://github.com/Natta75/kanban.git
git fetch origin
git checkout -b main origin/main
git branch --set-upstream-to=origin/main main

# Create backup directory
mkdir -p /var/www/backups
chmod 755 /var/www/backups

# Test backup creation
tar -czf /var/www/backups/test-backup.tar.gz --exclude='.git' /var/www/kanban.75vibe-coding.ru/
ls -lh /var/www/backups/test-backup.tar.gz
rm /var/www/backups/test-backup.tar.gz

# Exit server
exit
```

### Step 6: Test Deployment

Run a dry-run to verify everything is configured correctly:

```bash
./deploy.sh --dry-run
```

If everything is OK, try a real deployment:

```bash
# Make a small test change
echo "# Test deployment" >> README.md

# Deploy
./deploy.sh
```

If successful, you should see:

```
================================================================
Deployment completed successfully!
================================================================
```

## Daily Usage

### Standard Deployment

To deploy your changes to production:

```bash
./deploy.sh
```

The script will automatically:

1. Check configuration and SSH connection
2. Commit any uncommitted changes (will prompt you)
3. Push to GitHub
4. Create a backup on the server
5. Pull changes on the server
6. Update CSS/JS versions for cache busting
7. Fix file permissions
8. Reload Nginx
9. Run health checks
10. Report success or automatically rollback on failure

### Fast Deployment (Skip Backup)

For minor changes where you want to save time:

```bash
./deploy.sh --no-backup
```

**Warning:** Only use this for trivial changes. Backups are your safety net!

### View Help

```bash
./deploy.sh --help
```

### View Deployment Log

All deployments are logged to `deploy.log`:

```bash
# View recent deployments
tail -n 50 deploy.log

# Search for errors
grep ERROR deploy.log

# Filter by date
grep "2025-12-08" deploy.log
```

## Troubleshooting

### Issue 1: SSH Connection Refused

**Symptoms:**
```
[ERROR] Cannot connect to server via SSH
```

**Solutions:**

1. Check if server is online:
   ```bash
   ping 88.218.168.98
   ```

2. Verify SSH key exists:
   ```bash
   ls -la ~/.ssh/kanban_deploy*
   ```

3. Check SSH key permissions:
   ```bash
   chmod 600 ~/.ssh/kanban_deploy
   ```

4. Test SSH manually:
   ```bash
   ssh -i ~/.ssh/kanban_deploy root@88.218.168.98
   ```

### Issue 2: Permission Denied (publickey)

**Symptoms:**
```
Permission denied (publickey)
```

**Solutions:**

1. Verify SSH key is copied to server:
   ```bash
   ssh-copy-id -i ~/.ssh/kanban_deploy.pub root@88.218.168.98
   ```

2. Check authorized_keys on server:
   ```bash
   ssh root@88.218.168.98 "cat ~/.ssh/authorized_keys"
   ```

3. Verify key permissions on server:
   ```bash
   ssh root@88.218.168.98 "chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
   ```

### Issue 3: Git Pull Fails on Server

**Symptoms:**
```
[ERROR] Failed to pull changes on server
```

**Solutions:**

1. SSH to server and check git status:
   ```bash
   ssh root@88.218.168.98
   cd /var/www/kanban.75vibe-coding.ru
   git status
   ```

2. If there are local modifications:
   ```bash
   git reset --hard HEAD
   git pull origin main
   ```

3. Verify remote URL:
   ```bash
   git remote -v
   ```

### Issue 4: Health Check Fails

**Symptoms:**
```
[ERROR] Health check failed: HTTP 502
```

**Solutions:**

1. Check Nginx status:
   ```bash
   ssh root@88.218.168.98 "systemctl status nginx"
   ```

2. Check Nginx error log:
   ```bash
   ssh root@88.218.168.98 "tail -n 50 /var/log/nginx/error.log"
   ```

3. Test Nginx configuration:
   ```bash
   ssh root@88.218.168.98 "nginx -t"
   ```

4. Restart Nginx if needed:
   ```bash
   ssh root@88.218.168.98 "systemctl restart nginx"
   ```

### Issue 5: Cache Issues (Old Version Shows)

**Symptoms:**
Browser shows old cached version after deployment

**Solutions:**

1. Hard refresh in browser:
   - **Windows/Linux:** Ctrl + Shift + R
   - **Mac:** Cmd + Shift + R

2. Clear browser cache completely

3. Verify versions are updated:
   ```bash
   curl https://kanban.75vibe-coding.ru | grep "\.css?v="
   ```

4. Check if deployment updated versions:
   ```bash
   grep "Updating asset versions" deploy.log | tail -n 1
   ```

## Rollback Procedures

### Automatic Rollback

The script automatically rolls back if:
- Health check fails (HTTP status != 200)
- Critical files are missing
- Git pull fails
- Nginx reload fails

### Manual Rollback

To manually rollback to the previous deployment:

```bash
./deploy.sh --rollback
```

This will:
1. Attempt git reset to previous commit
2. If that fails, restore from latest backup
3. Reload Nginx
4. Run health checks

### Restore Specific Backup

To manually restore a specific backup:

```bash
# List available backups
ssh root@88.218.168.98 "ls -lh /var/www/backups/"

# Restore specific backup (example)
ssh root@88.218.168.98 "cd /var/www && \
    tar -xzf backups/kanban-20251208-143000.tar.gz && \
    systemctl reload nginx"
```

## Security Best Practices

### SSH Key Security

- ✅ Never commit your private key (`~/.ssh/kanban_deploy`) to git
- ✅ Keep private key permissions at 600: `chmod 600 ~/.ssh/kanban_deploy`
- ✅ Consider adding a passphrase to your SSH key for extra security
- ✅ Use a dedicated key for deployment (don't reuse personal keys)

### Configuration Security

- ✅ `deploy.config` is automatically excluded from git
- ✅ Keep `deploy.config` permissions at 600: `chmod 600 deploy.config`
- ✅ Never share your `deploy.config` in screenshots or logs
- ✅ Rotate SSH keys periodically (every 6-12 months)

### Server Security

Recommended additional security measures:

1. **Install fail2ban for SSH protection:**
   ```bash
   ssh root@88.218.168.98 "apt install -y fail2ban && systemctl enable fail2ban"
   ```

2. **Keep server updated:**
   ```bash
   ssh root@88.218.168.98 "apt update && apt upgrade -y"
   ```

3. **Configure firewall (UFW):**
   ```bash
   ssh root@88.218.168.98 "ufw status"
   # Should show ports 22, 80, 443 allowed
   ```

4. **Monitor server logs:**
   ```bash
   ssh root@88.218.168.98 "tail -f /var/log/auth.log"
   ```

## Advanced Topics

### Multiple Environments

To set up staging environment:

1. Create `deploy.config.staging`:
   ```bash
   cp deploy.config deploy.config.staging
   # Edit with staging server details
   ```

2. Create deployment wrapper:
   ```bash
   #!/bin/bash
   # deploy-staging.sh
   cp deploy.config.staging deploy.config
   ./deploy.sh "$@"
   ```

### Deployment Notifications

Add Telegram/Slack notifications by modifying `deploy.sh`:

```bash
# After successful deployment, add:
curl -X POST https://api.telegram.org/bot<TOKEN>/sendMessage \
    -d chat_id=<CHAT_ID> \
    -d text="✅ Kanban deployed successfully! Commit: $COMMIT_HASH"
```

### GitHub Actions Integration

For future migration to full CI/CD, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/deploy
          chmod 600 ~/.ssh/deploy

      - name: Deploy
        run: ./deploy.sh
```

### Monitoring

Set up uptime monitoring:

1. **UptimeRobot** (free tier): https://uptimerobot.com
   - Monitor: https://kanban.75vibe-coding.ru
   - Alert on downtime via email/SMS

2. **StatusCake** (free tier): https://www.statuscake.com
   - More detailed monitoring
   - Performance metrics

### Backup Management

**List all backups:**
```bash
ssh root@88.218.168.98 "ls -lh /var/www/backups/"
```

**Download backup locally:**
```bash
scp -i ~/.ssh/kanban_deploy root@88.218.168.98:/var/www/backups/kanban-20251208-143000.tar.gz ~/Downloads/
```

**Manual backup:**
```bash
ssh root@88.218.168.98 "tar -czf /var/www/backups/manual-$(date +%Y%m%d).tar.gz \
    --exclude='.git' /var/www/kanban.75vibe-coding.ru/"
```

## Workflow Summary

**Development Workflow:**

```
1. Make changes locally
   ↓
2. Test locally (optional)
   ↓
3. Run: ./deploy.sh
   ↓
4. Script commits & pushes to GitHub
   ↓
5. Script creates backup on server
   ↓
6. Script deploys to server
   ↓
7. Script verifies deployment
   ↓
8. ✅ Done! (or automatically rolled back on error)
```

**Total time:** 15-25 seconds

## Support

If you encounter issues not covered in this guide:

1. Check the deployment log: `cat deploy.log`
2. Check Nginx error log: `ssh root@88.218.168.98 "tail -n 50 /var/log/nginx/error.log"`
3. Verify server status: `ssh root@88.218.168.98 "systemctl status nginx"`
4. Test application manually: Open https://kanban.75vibe-coding.ru in browser

## Quick Reference

```bash
# Standard deployment
./deploy.sh

# Fast deployment (no backup)
./deploy.sh --no-backup

# Rollback
./deploy.sh --rollback

# Dry run
./deploy.sh --dry-run

# Help
./deploy.sh --help

# View logs
tail -f deploy.log

# Test SSH
ssh -i ~/.ssh/kanban_deploy root@88.218.168.98

# Check server status
ssh root@88.218.168.98 "systemctl status nginx"

# View server logs
ssh root@88.218.168.98 "tail -f /var/log/nginx/error.log"

# List backups
ssh root@88.218.168.98 "ls -lh /var/www/backups/"
```

---

**Happy Deploying!** 🚀
