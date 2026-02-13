# ⚠️ Database Connection Issue

## Problem
The hostname `db.bjjsxufayzqnlilgwmbk.supabase.co` is not resolving (ENOTFOUND error).

This means we need to get the correct connection strings from your Supabase dashboard.

## How to Get the Correct Connection Strings

### Step 1: Go to Database Settings
Visit: https://supabase.com/dashboard/project/bjjsxufayzqnlilgwmbk/settings/database

### Step 2: Find Connection Strings
Look for the "Connection string" section. You should see:

**Connection Pooling (Transaction Mode):**
```
postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Direct Connection (Session Mode):**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

### Step 3: Copy the Exact Strings
1. Click on "URI" tab
2. Make sure "Display connection pooling string" is checked for the pooler
3. Copy the EXACT connection string (it will have your password already filled in)
4. Do the same for the direct connection

### Step 4: Update .env.local
Replace the DATABASE_URL and DIRECT_URL in your `.env.local` file with the exact strings from Supabase.

## Alternative: Use Supabase Connection Info

If the connection strings don't work, you can also find:
- **Host**: Should be something like `db.PROJECT_REF.supabase.co` or `aws-0-REGION.pooler.supabase.com`
- **Port**: 5432 (direct) or 6543 (pooler)
- **Database**: postgres
- **User**: postgres
- **Password**: Your database password

## Common Issues

### Issue 1: Project Not Fully Provisioned
If your Supabase project was just created, it might take a few minutes to fully provision. Wait 5-10 minutes and try again.

### Issue 2: Wrong Region
The connection string shows `aws-0-us-east-1` but your actual database might be in a different region. Check your project settings.

### Issue 3: Paused Project
Free tier Supabase projects pause after inactivity. Go to your dashboard and make sure the project is active (green status).

## Next Steps

1. Go to: https://supabase.com/dashboard/project/bjjsxufayzqnlilgwmbk/settings/database
2. Copy the EXACT connection strings
3. Share them with me (I'll help you update .env.local)
4. We'll test the connection again

## Quick Test

You can also test the connection directly from the Supabase dashboard:
1. Go to SQL Editor
2. Run: `SELECT version();`
3. If this works, your database is active and we just need the correct connection string
