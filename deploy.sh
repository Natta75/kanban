#!/bin/bash

#================================================================
# Kanban Deployment Script
#
# Automated deployment script for Kanban application
# Usage: ./deploy.sh [options]
#================================================================

set -e  # Exit on error

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/deploy.config"
LOG_FILE="$SCRIPT_DIR/deploy.log"

#================================================================
# COLOR CODES
#================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

#================================================================
# LOGGING FUNCTIONS
#================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >> "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $1" >> "$LOG_FILE"
}

#================================================================
# UTILITY FUNCTIONS
#================================================================

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "Command '$1' not found. Please install it first."
        exit 1
    fi
}

run_ssh() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "$1"
}

#================================================================
# VALIDATION FUNCTIONS
#================================================================

check_config() {
    log_info "Checking configuration..."

    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "Configuration file not found: $CONFIG_FILE"
        log_info "Please copy deploy.config.example to deploy.config and customize it"
        exit 1
    fi

    # Source configuration
    source "$CONFIG_FILE"

    # Validate required variables
    if [ -z "$SSH_USER" ] || [ -z "$SSH_HOST" ] || [ -z "$SSH_KEY" ]; then
        log_error "Missing required configuration variables (SSH_USER, SSH_HOST, SSH_KEY)"
        exit 1
    fi

    if [ ! -f "$SSH_KEY" ]; then
        log_error "SSH key not found: $SSH_KEY"
        log_info "Please generate SSH key: ssh-keygen -t ed25519 -f $SSH_KEY"
        exit 1
    fi

    log_success "Configuration OK"
}

check_git_repo() {
    log_info "Checking git repository..."

    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not a git repository"
        exit 1
    fi

    # Check if on correct branch
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "$GIT_BRANCH" ]; then
        log_warning "Current branch is '$current_branch', expected '$GIT_BRANCH'"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    log_success "Git repository OK"
}

check_ssh_connection() {
    log_info "Testing SSH connection..."

    if ! run_ssh "echo 'Connection OK'" > /dev/null 2>&1; then
        log_error "Cannot connect to server via SSH"
        log_info "Please check SSH_HOST, SSH_USER, and SSH_KEY in $CONFIG_FILE"
        exit 1
    fi

    log_success "SSH connection OK"
}

check_uncommitted_changes() {
    log_info "Checking for uncommitted changes..."

    if [ -n "$(git status --porcelain)" ]; then
        log_warning "You have uncommitted changes"
        git status --short
        echo
        read -p "Commit all changes now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            return 0  # Will commit in git_push
        else
            log_error "Please commit or stash your changes first"
            exit 1
        fi
    fi

    log_success "Working directory clean"
}

#================================================================
# DEPLOYMENT FUNCTIONS
#================================================================

git_push() {
    log_info "Committing and pushing to GitHub..."

    # Check if there are changes to commit
    if [ -n "$(git status --porcelain)" ]; then
        # Add all changes
        git add .

        # Commit with timestamp
        commit_message="Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
        git commit -m "$commit_message"
        log_info "Created commit: $commit_message"
    fi

    # Push to GitHub
    if ! git push origin "$GIT_BRANCH"; then
        log_error "Failed to push to GitHub"
        exit 1
    fi

    # Get commit hash
    COMMIT_HASH=$(git rev-parse --short HEAD)
    log_success "Pushed to GitHub (commit: $COMMIT_HASH)"
}

server_backup() {
    log_info "Creating backup on server..."

    backup_name="kanban-$(date '+%Y%m%d-%H%M%S').tar.gz"
    backup_path="$BACKUP_DIR/$backup_name"

    # Create backup
    if ! run_ssh "tar -czf $backup_path --exclude='.git' $DEPLOY_PATH 2>/dev/null"; then
        log_error "Failed to create backup"
        exit 1
    fi

    log_success "Backup created: $backup_name"

    # Cleanup old backups
    cleanup_backups
}

cleanup_backups() {
    log_info "Cleaning up old backups (keeping last $KEEP_BACKUPS)..."

    run_ssh "cd $BACKUP_DIR && ls -t kanban-*.tar.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm"

    log_success "Old backups cleaned up"
}

server_deploy() {
    log_info "Deploying to server..."

    # Git pull on server
    if ! run_ssh "cd $DEPLOY_PATH && git pull origin $GIT_BRANCH"; then
        log_error "Failed to pull changes on server"
        log_warning "Attempting rollback..."
        rollback_deployment
        exit 1
    fi

    log_success "Code deployed to server"
}

update_versions() {
    log_info "Updating asset versions for cache busting..."

    # Generate version timestamp
    VERSION=$(date +%s)

    # Update versions in index.html on server
    run_ssh "cd $DEPLOY_PATH && sed -i 's/\\.css\\?v=[0-9]*/\\.css?v=$VERSION/g' index.html && sed -i 's/\\.js\\?v=[0-9]*/\\.js?v=$VERSION/g' index.html" || \
    run_ssh "cd $DEPLOY_PATH && sed -i 's/\\.css\"/\\.css?v=$VERSION\"/g' index.html && sed -i 's/\\.js\"/\\.js?v=$VERSION\"/g' index.html"

    log_success "Asset versions updated to v=$VERSION"
}

fix_permissions() {
    log_info "Fixing file permissions..."

    run_ssh "chown -R www-data:www-data $DEPLOY_PATH && \
             find $DEPLOY_PATH -type d -exec chmod 755 {} \\; && \
             find $DEPLOY_PATH -type f -exec chmod 644 {} \\;"

    log_success "Permissions fixed"
}

reload_nginx() {
    if [ "$NGINX_RELOAD" = true ]; then
        log_info "Reloading Nginx..."

        # Test nginx configuration first
        if ! run_ssh "nginx -t 2>&1"; then
            log_error "Nginx configuration test failed"
            return 1
        fi

        # Reload nginx
        if ! run_ssh "systemctl reload nginx"; then
            log_error "Failed to reload Nginx"
            return 1
        fi

        log_success "Nginx reloaded"
    else
        log_info "Nginx reload skipped (NGINX_RELOAD=false)"
    fi
}

health_check() {
    log_info "Running health checks..."

    # HTTP status check
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL")

    if [ "$http_code" != "200" ]; then
        log_error "Health check failed: HTTP $http_code"
        return 1
    fi

    log_success "Health check passed: HTTP $http_code"

    # Check critical files
    log_info "Checking critical files..."
    for file in "${CRITICAL_FILES[@]}"; do
        if ! run_ssh "test -f $DEPLOY_PATH/$file"; then
            log_error "Critical file missing: $file"
            return 1
        fi
    done

    log_success "All critical files present"

    return 0
}

#================================================================
# ROLLBACK FUNCTIONS
#================================================================

rollback_deployment() {
    log_warning "Rolling back deployment..."

    # Try git reset first
    if run_ssh "cd $DEPLOY_PATH && git reset --hard HEAD^"; then
        log_success "Rolled back via git reset"

        # Reload nginx after rollback
        reload_nginx

        # Check health after rollback
        if health_check; then
            log_success "Rollback successful, application is healthy"
            return 0
        fi
    fi

    # If git reset failed, try restoring from backup
    log_warning "Git rollback failed, restoring from backup..."
    restore_from_backup
}

restore_from_backup() {
    log_info "Restoring from latest backup..."

    # Get latest backup
    latest_backup=$(run_ssh "ls -t $BACKUP_DIR/kanban-*.tar.gz | head -n 1")

    if [ -z "$latest_backup" ]; then
        log_error "No backups found"
        exit 1
    fi

    log_info "Restoring from: $(basename $latest_backup)"

    # Restore backup
    if ! run_ssh "cd $(dirname $DEPLOY_PATH) && tar -xzf $latest_backup"; then
        log_error "Failed to restore backup"
        exit 1
    fi

    log_success "Restored from backup"

    # Reload nginx
    reload_nginx

    # Check health
    if health_check; then
        log_success "Restore successful, application is healthy"
    else
        log_error "Application still unhealthy after restore"
        exit 1
    fi
}

rollback_to_previous() {
    log_info "Rolling back to previous deployment..."
    rollback_deployment
    log_success "Rollback completed"
}

#================================================================
# MAIN DEPLOYMENT FLOW
#================================================================

deploy() {
    local start_time=$(date +%s)

    echo "================================================================"
    echo -e "${CYAN}Kanban Deployment Script${NC}"
    echo "================================================================"
    echo

    # Step 1: Pre-deployment validation
    check_config
    check_command "git"
    check_command "ssh"
    check_command "curl"
    check_git_repo
    check_ssh_connection
    check_uncommitted_changes

    echo
    log_info "Starting deployment..."
    echo

    # Step 2: Git operations
    git_push

    # Step 3: Server backup
    if [ "$NO_BACKUP" != true ]; then
        server_backup
    else
        log_warning "Backup skipped (--no-backup flag)"
    fi

    # Step 4: Deploy
    server_deploy

    # Step 5: Update asset versions
    update_versions

    # Step 6: Fix permissions
    fix_permissions

    # Step 7: Reload Nginx
    reload_nginx

    # Step 8: Health check
    echo
    if ! health_check; then
        log_error "Health check failed, rolling back..."
        rollback_deployment
        exit 1
    fi

    # Step 9: Success report
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo
    echo "================================================================"
    log_success "Deployment completed successfully!"
    echo "================================================================"
    echo
    echo -e "${CYAN}Deployment Summary:${NC}"
    echo "  Commit: $COMMIT_HASH"
    echo "  Duration: ${duration}s"
    echo "  URL: $APP_URL"
    echo "  Log: $LOG_FILE"
    echo
}

#================================================================
# CLI INTERFACE
#================================================================

show_help() {
    echo "Kanban Deployment Script"
    echo
    echo "Usage: ./deploy.sh [options]"
    echo
    echo "Options:"
    echo "  --help          Show this help message"
    echo "  --no-backup     Skip backup creation (faster)"
    echo "  --rollback      Rollback to previous deployment"
    echo "  --dry-run       Show what would be done without executing"
    echo
    echo "Examples:"
    echo "  ./deploy.sh                 # Standard deployment"
    echo "  ./deploy.sh --no-backup     # Fast deployment without backup"
    echo "  ./deploy.sh --rollback      # Rollback to previous version"
    echo
}

dry_run() {
    echo "DRY RUN MODE - No actual changes will be made"
    echo
    echo "Would perform the following steps:"
    echo "1. Check configuration and SSH connection"
    echo "2. Commit and push changes to GitHub"
    echo "3. Create backup on server"
    echo "4. Pull changes on server"
    echo "5. Update asset versions"
    echo "6. Fix file permissions"
    echo "7. Reload Nginx"
    echo "8. Run health checks"
    echo
    exit 0
}

#================================================================
# MAIN
#================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help)
                show_help
                exit 0
                ;;
            --no-backup)
                NO_BACKUP=true
                shift
                ;;
            --rollback)
                check_config
                rollback_to_previous
                exit 0
                ;;
            --dry-run)
                dry_run
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Run deployment
    deploy
}

# Run main function
main "$@"
