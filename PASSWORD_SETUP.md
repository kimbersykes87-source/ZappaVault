# Password Protection Setup Guide

**Date:** January 28, 2025

ZappaVault now has global password protection. Anyone who knows the password can access the site.

---

## How It Works

1. **Family members visit** `https://zappavault.pages.dev`
2. **Login page appears** asking for password
3. **Enter password** → Access granted
4. **Session lasts 24 hours** (no need to re-enter password during that time)

---

## Setup Instructions

### Step 1: Set the Password in Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **ZappaVault** (your project)
3. Click **Settings** tab
4. Scroll to **Environment Variables**
5. Click **Add variable**
6. Set:
   - **Variable name:** `SITE_PASSWORD`
   - **Value:** Your family password (e.g., `MyFamily2025!`)
   - **Environment:** Select **Production** (and **Preview** if you want)
7. Click **Save**

### Step 2: Trigger a New Deployment

After adding the environment variable, you need to trigger a new deployment:

1. Go to **Deployments** tab
2. Click **Retry deployment** on the latest deployment, OR
3. Push a new commit to trigger automatic deployment

**Important:** The password won't work until you deploy after adding the environment variable.

---

## Testing

1. Visit `https://zappavault.pages.dev`
2. You should see a login page
3. Enter your password
4. You should be redirected to the main site
5. Try visiting the site again (should work without password for 24 hours)

---

## Password Requirements

- **No specific requirements** - use any password you want
- **Recommendation:** Use a strong password that's easy for family to remember
- **Example:** `ZappaFamily2025!` or `MyMusicCollection2025`

---

## Changing the Password

1. Go to Cloudflare Pages → Settings → Environment Variables
2. Edit `SITE_PASSWORD`
3. Enter new password
4. Save
5. Trigger new deployment
6. **Note:** All existing sessions will be invalidated (users will need to log in again)

---

## Disabling Password Protection

If you want to disable password protection (make site public):

1. Go to Cloudflare Pages → Settings → Environment Variables
2. Delete or leave `SITE_PASSWORD` empty
3. Trigger new deployment
4. Site will be accessible without password

**Note:** This is NOT recommended if you're hosting copyrighted content. Password protection helps reduce legal liability.

---

## Troubleshooting

### "Login page doesn't appear"
- Check that `SITE_PASSWORD` is set in Cloudflare Pages
- Verify you've deployed after adding the variable
- Check browser console for errors

### "Password doesn't work"
- Verify password is set correctly (no extra spaces)
- Make sure you're using the exact password from environment variables
- Try clearing browser cookies and logging in again

### "I'm logged out too often"
- Sessions last 24 hours by default
- If you clear cookies, you'll need to log in again
- If you use incognito/private browsing, sessions don't persist

### "I want to change session duration"
- Edit `functions/utils/auth.ts`
- Find `Max-Age=86400` (24 hours in seconds)
- Change to desired duration (e.g., `604800` for 7 days)

---

## Security Notes

- Password is hashed using SHA-256 (sufficient for family use)
- Sessions use secure, HttpOnly cookies
- Cookies are only sent over HTTPS
- Sessions are stored client-side (in cookies)

**For stronger security:**
- Consider using Cloudflare Access (see `ACCESS_CONTROL_OPTIONS.md`)
- Or implement per-user authentication with a database

---

## Contact

For issues or questions: **Kimber Sykes** (kimbersykes@hotmail.com)

