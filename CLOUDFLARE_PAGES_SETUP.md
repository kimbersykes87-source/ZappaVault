# Cloudflare Pages Configuration Guide

## Current Status
✅ **KV Data**: 98 albums successfully uploaded to KV namespace  
✅ **Environment Variables**: All required variables are in your `.env` file  
✅ **Bindings**: Configured in `wrangler.toml` (needs deployment to take effect)

## Required Settings in Cloudflare Pages Dashboard

### 1. Variables and Secrets (Already Configured ✅)
You already have these set in your dashboard:
- `ADMIN_TOKEN` = `super-secret-admin-token` (Secret)
- `DROPBOX_TOKEN` = (your long token) (Secret)  
- `CLOUDFLARE_API_TOKEN` = `iG9gANguVSZH1EBtbCNyuzAUY8YIR1PtwzNFv_G8` (Secret)

### 2. Bindings (CONFIGURED ✅)

**Status**: Bindings are managed through `wrangler.toml` file

The `wrangler.toml` file has been updated with:
```toml
[[kv_namespaces]]
binding = "LIBRARY_KV"
id = "139b9557516d493d893c1b35b3c6190a"
```

**Next Step**: Commit and push this change, or trigger a new deployment for the binding to take effect.

## Next Steps

1. **Commit and Push the wrangler.toml Change**
   ```bash
   git add wrangler.toml
   git commit -m "Add KV namespace binding for LIBRARY_KV"
   git push
   ```

2. **Wait for Deployment**
   - Cloudflare Pages will automatically detect the change and deploy
   - Or manually trigger a deployment from the dashboard

3. **Verify**
   - Visit: https://zappavault.pages.dev
   - Should show "98 albums indexed" instead of "2 albums indexed"
   - All 98 albums should be visible in the library

## Summary of Required Configuration

| Setting Type | Location | Variable Name | Value |
|-------------|----------|---------------|-------|
| **Secret** | Variables and Secrets | `ADMIN_TOKEN` | `super-secret-admin-token` ✅ |
| **Secret** | Variables and Secrets | `DROPBOX_TOKEN` | (your token) ✅ |
| **Secret** | Variables and Secrets | `CLOUDFLARE_API_TOKEN` | `iG9gANguVSZH1EBtbCNyuzAUY8YIR1PtwzNFv_G8` ✅ |
| **Binding** | wrangler.toml | `LIBRARY_KV` | KV namespace `139b9557516d493d893c1b35b3c6190a` ✅ |

## Why This Matters

Your Functions code expects `env.LIBRARY_KV` to access the KV namespace:
```typescript
if (env.LIBRARY_KV) {
  const cached = await env.LIBRARY_KV.get('library-snapshot', 'json');
  // ... returns 98 albums
}
return sampleLibrary; // Falls back to 2 sample albums
```

Without the binding, `env.LIBRARY_KV` is `undefined`, so it always falls back to the sample library.

