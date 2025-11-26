# How to Add CURSOR_PAT - Fixed Instructions

## Option 1: Use Classic Tokens (Easier - Recommended)

1. **Go to GitHub Settings:**
   - https://github.com/settings/tokens

2. **Click "Tokens (classic)" tab** (not "Fine-grained tokens")
   - You should see a button: **"Generate new token"** → **"Generate new token (classic)"**

3. **Configure Classic Token:**
   - **Note**: `Cursor IDE - ZappaVault`
   - **Expiration**: Your choice
   - **Select scopes** - You'll see checkboxes for:
     - ✅ **repo** (Full control of private repositories)
     - ✅ **workflow** (Update GitHub Action workflows)
   - Click **Generate token**

4. **Copy the token** (starts with `ghp_`)

## Option 2: Use Fine-Grained Tokens (If Classic Not Available)

If you only see "Fine-grained tokens", use these permissions:

1. **Repository Access:**
   - Select: **"Only select repositories"**
   - Choose: **ZappaVault**

2. **Repository Permissions:**
   - **Actions**: Read and write
   - **Contents**: Read and write
   - **Metadata**: Read-only (required)
   - **Pull requests**: Read and write (optional but recommended)
   - **Workflows**: Read and write

3. **Account Permissions:**
   - Usually not needed, but if required:
     - **Email addresses**: Read-only

4. **Generate and copy the token**

## Step 2: Add to GitHub Secrets

1. Go to: https://github.com/kimbersykes87-source/ZappaVault/settings/secrets/actions
2. Click **"New repository secret"**
3. Enter:
   - **Name**: `CURSOR_PAT`
   - **Secret**: Paste your token
4. Click **"Add secret"**

## Quick Visual Guide

### Classic Token Interface:
```
┌─────────────────────────────────┐
│ Personal access tokens (classic)│
├─────────────────────────────────┤
│ [Generate new token] [classic] │
│                                 │
│ ☑ repo                          │
│ ☑ workflow                      │
└─────────────────────────────────┘
```

### Fine-Grained Token Interface:
```
┌─────────────────────────────────┐
│ Fine-grained personal access    │
│   tokens                        │
├─────────────────────────────────┤
│ Repository access:              │
│ ○ All repositories              │
│ ● Only select repositories      │
│   └─ ZappaVault                 │
│                                 │
│ Repository permissions:         │
│ Actions: [Read and write ▼]    │
│ Contents: [Read and write ▼]   │
│ Metadata: [Read-only ▼]        │
│ Workflows: [Read and write ▼]  │
└─────────────────────────────────┘
```

## Troubleshooting

**If you don't see "Tokens (classic)" option:**
- Your organization might require fine-grained tokens
- Use Option 2 above with the fine-grained permissions

**If permissions still don't work:**
- Make sure you selected the correct repository (ZappaVault)
- Try adding "Pull requests: Read and write" as well
- Restart Cursor IDE after adding the secret

