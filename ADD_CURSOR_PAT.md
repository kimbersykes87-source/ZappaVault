# How to Add CURSOR_PAT to GitHub Secrets

## Step 1: Create a GitHub Personal Access Token

1. **Go to GitHub Settings:**
   - Click your profile picture (top right) → **Settings**
   - Or go directly to: https://github.com/settings/tokens

2. **Create a New Token:**
   - Scroll down to **Developer settings** (left sidebar)
   - Click **Personal access tokens**
   - Click **Tokens (classic)** or **Fine-grained tokens**
   - Click **Generate new token** → **Generate new token (classic)**

3. **Configure the Token:**
   - **Note**: Name it something like `Cursor IDE - ZappaVault` or `Cursor PAT`
   - **Expiration**: Choose your preference (90 days, 1 year, or no expiration)
   - **Select Scopes** (permissions):
     - ✅ **repo** (Full control of private repositories)
       - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`
     - ✅ **workflow** (Update GitHub Action workflows)
     - ✅ **read:org** (Read org and team membership) - Optional
     - ✅ **read:user** (Read user profile data) - Optional

4. **Generate and Copy:**
   - Scroll down and click **Generate token**
   - ⚠️ **IMPORTANT**: Copy the token immediately! It will only be shown once.
   - The token will look like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Add Token to GitHub Secrets

1. **Go to Repository Secrets:**
   - Navigate to: https://github.com/kimbersykes87-source/ZappaVault/settings/secrets/actions

2. **Add New Secret:**
   - Click the green button: **New repository secret**

3. **Enter Secret Details:**
   - **Name**: `CURSOR_PAT`
   - **Secret**: Paste the token you copied (starts with `ghp_`)
   - Click **Add secret**

4. **Verify:**
   - You should see `CURSOR_PAT` in your list of repository secrets
   - It will show "Updated: just now"

## Step 3: (Optional) Add to Local .env File

If you want Cursor to use this token locally, you can add it to your `.env` file:

1. Open `webapp/.env`
2. Add this line:
   ```
   CURSOR_PAT=ghp_your_token_here
   ```
3. Save the file

**Note**: The `.env` file is gitignored, so it won't be committed to the repository.

## What CURSOR_PAT is Used For

- **Cursor IDE Integration**: Allows Cursor to authenticate with GitHub
- **Repository Access**: Enables Cursor to read/write to your repositories
- **Workflow Management**: Allows Cursor to trigger and manage GitHub Actions
- **Code Suggestions**: Helps Cursor provide better context-aware suggestions

## Security Notes

- ⚠️ **Never commit the token to git** - it's already in `.gitignore`
- ⚠️ **Don't share the token** publicly
- ⚠️ **Regenerate if compromised** - you can revoke old tokens in GitHub settings
- ✅ **Use fine-grained tokens** if you want more granular control (newer feature)

## Troubleshooting

If Cursor still doesn't work after adding the token:
1. Restart Cursor IDE
2. Check that the token has the correct permissions
3. Verify the token hasn't expired
4. Check Cursor's settings/preferences for GitHub authentication

