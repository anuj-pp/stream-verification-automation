#!/bin/bash

# Quick deployment script for GitHub Pages
# Usage: ./deploy.sh

set -e

echo "🚀 S3 Screenshot Debugger - GitHub Pages Deployment"
echo "=================================================="
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Error: Not a git repository. Run 'git init' first."
    exit 1
fi

# Check if remote is set
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "⚠️  No remote 'origin' found."
    echo ""
    echo "Please set up your GitHub repository first:"
    echo "  1. Create a repository on GitHub"
    echo "  2. Run: git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git"
    echo ""
    exit 1
fi

# Show current remote
REMOTE_URL=$(git remote get-url origin)
echo "📍 Remote: $REMOTE_URL"
echo ""

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Uncommitted changes detected"
    echo ""
    
    # Stage all changes
    git add .
    
    # Show what will be committed
    echo "Files to be committed:"
    git status --short
    echo ""
    
    # Get commit message
    read -p "Enter commit message (or press Enter for default): " COMMIT_MSG
    
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="Update: $(date '+%Y-%m-%d %H:%M')"
    fi
    
    # Commit
    git commit -m "$COMMIT_MSG"
    echo "✅ Changes committed"
    echo ""
else
    echo "✅ No uncommitted changes"
    echo ""
fi

# Check if we have commits
if ! git log -1 > /dev/null 2>&1; then
    echo "❌ Error: No commits yet. Create an initial commit first."
    exit 1
fi

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your site should be available soon at:"
echo "   https://YOUR-USERNAME.github.io/YOUR-REPO/"
echo ""
echo "⏱️  Note: It may take 1-2 minutes for GitHub Pages to deploy"
echo ""
echo "📋 Next steps:"
echo "   1. Go to your repository on GitHub"
echo "   2. Click Settings → Pages"
echo "   3. Ensure GitHub Actions is selected as the source"
echo "   4. Check the Actions tab for deployment status"
echo ""
