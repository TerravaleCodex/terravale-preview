# Terravale: verified storage migration to Neon staging

This is a **manual-only** workflow. Nothing is copied on merge or on normal deployment.

## Why

The production Supabase project currently holds 10 **private character portraits** and 3 **public profile avatars**, about 6.45 MB. Staging Neon has matching bucket names and access modes, but the files themselves are not migrated yet. Their original Supabase objects must remain available until the full site cutover.

## Configure three GitHub Actions secrets

In `TerravaleCodex/terravale-preview`, open **Settings → Secrets and variables → Actions**. Add these as **repository secrets**; never commit them, share them in tickets, or paste them into chats:

- `TERRAVALE_SUPABASE_SERVICE_ROLE_KEY`: the **production** Supabase service-role secret for project `emwlvbmnrrhxhrmlwkhs`.
- `TERRAVALE_NEON_S3_ACCESS_KEY_ID`: the Object Storage S3 access key ID for Neon **staging** branch `br-wandering-queen-bg2v6gjp`.
- `TERRAVALE_NEON_S3_SECRET_ACCESS_KEY`: the corresponding Neon **staging** Object Storage S3 secret.

These keys are highly privileged. Only trusted maintainers should modify and run workflows on `main`. **Remove the three repository secrets after the verified final synchronization is complete.**

Use the existing Neon [staging branch](https://console.neon.tech/app/projects/still-dust-11470556/branches/br-wandering-queen-bg2v6gjp), **not Neon main**. The script pins both the production Supabase source project and the staging Neon storage endpoint. The source URL, destination URL and region are fixed in the Action; there are no extra secrets to enter.

## Execute safely

1. Open **Actions → Copy Terravale media to Neon staging (manual)**.
2. Click **Run workflow**, keep `execute=false`, and run the default **inventory-only** dry run. No Neon writes occur.
3. Verify the run reports expected source counts (initial snapshot: 10 portraits, 3 avatars) with no metadata warnings.
4. Run it again with `execute=true` when ready. This explicitly enables copying to **Neon staging only**. No database rows are modified.
5. Check that it reports `copied + already-matching = source total`; every object undergoes SHA-256 round-trip validation. Check bucket counts directly in Neon staging afterward.

The copy preserves the exact object key and MIME type, and treats destination mismatches as errors **without overwriting**. It does not delete or mutate Supabase Storage files, and it does not switch the website.

## Scope and future cutover

The live website still loads portraits via Supabase. Copying objects alone does **not** redirect images in the Codex; the URL/signing layer must be migrated and tested for both private and public buckets.

Supabase production may receive new uploads after the staging copy. Re-run the same tool after that activity and again during final synchronization. Only retire Supabase Storage once the new site reads private images securely and all legacy files and references have been checked.

Sources: [Supabase Storage downloads](https://supabase.com/docs/guides/storage/serving/downloads) and [Neon Object Storage](https://neon.com/docs/get-started/backend-overview).
