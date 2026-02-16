#!/usr/bin/env bash

set -euo pipefail

OWNER="${1:-krishna-glitch}"
REPO="${2:-CreatorOps}"
TOKEN="${GITHUB_TOKEN:-}"
API="https://api.github.com"

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: GITHUB_TOKEN is required."
  echo "Usage:"
  echo "  GITHUB_TOKEN=ghp_xxx $0 [owner] [repo]"
  exit 1
fi

auth_header="Authorization: Bearer $TOKEN"
accept_header="Accept: application/vnd.github+json"

echo "Setting default branch to main for $OWNER/$REPO..."
curl -sS -X PATCH \
  -H "$auth_header" \
  -H "$accept_header" \
  "$API/repos/$OWNER/$REPO" \
  -d '{"default_branch":"main"}' >/dev/null

protect_branch() {
  local branch="$1"
  local approvals="$2"
  local enforce_admins="$3"

  echo "Applying protection to $branch..."
  curl -sS -X PUT \
    -H "$auth_header" \
    -H "$accept_header" \
    "$API/repos/$OWNER/$REPO/branches/$branch/protection" \
    -d "{
      \"required_status_checks\": {
        \"strict\": true,
        \"contexts\": [\"CI / Verify\"]
      },
      \"enforce_admins\": $enforce_admins,
      \"required_pull_request_reviews\": {
        \"dismiss_stale_reviews\": true,
        \"require_code_owner_reviews\": true,
        \"required_approving_review_count\": $approvals
      },
      \"restrictions\": null,
      \"required_conversation_resolution\": true,
      \"allow_force_pushes\": false,
      \"allow_deletions\": false
    }" >/dev/null
}

# Main: strictest rules
protect_branch "main" 1 true

# Staging: PR + checks + 1 approval
protect_branch "staging" 1 false

# Develop: PR + checks, no mandatory approval count
protect_branch "develop" 0 false

echo "Done."
echo "Protected branches: main, staging, develop"
