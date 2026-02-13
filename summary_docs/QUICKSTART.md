# CreatorOps OS - Quick Start Guide

## 🚀 You're All Set! Here's What to Do Next

### Step 1: Set Up Supabase (5 minutes)

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Click "New Project"
   - Choose a name (e.g., "creatorops-dev")
   - Set a strong database password
   - Choose a region close to you

2. **Get Your Credentials**
   - Go to Settings > API
   - Copy these values:
     - Project URL
     - `anon` `public` key
     - `service_role` `secret` key
   - Go to Settings > Database
   - Copy the connection string

3. **Configure Environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

### Step 2: Start Development (1 minute)

```bash
# Start the dev server
npm run dev
```

Open http://localhost:3000 - you should see the Next.js welcome page!

### Step 3: Verify Everything Works

```bash
# In a new terminal, run type checking
npm run type-check
# Should complete with no errors ✅

# Format your code
npm run format

# Check linting
npm run lint
```

## 📁 Project Structure Overview

```
Creator-ops/
├── app/                    # Next.js pages & layouts
│   ├── api/trpc/          # tRPC API endpoints
│   └── layout.tsx         # Root layout (has tRPC provider)
├── db/                     # Database layer
│   ├── schema/            # Drizzle schemas (add yours here)
│   ├── index.ts           # DB client
│   └── migrate.ts         # Migration runner
├── lib/                    # Utilities & configs
│   ├── supabase/          # Supabase clients
│   ├── trpc/              # tRPC setup
│   └── utils.ts           # Helper functions
├── server/                 # Server-side code
│   └── routers/           # tRPC routers
├── components/             # React components
│   └── ui/                # Radix UI components
└── types/                  # TypeScript types
```

## 🎯 Common Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run type-check` | Check TypeScript types |
| `npm run format` | Format code with Biome |
| `npm run lint` | Lint code with Biome |
| `npm run db:generate` | Generate DB migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio |

## 🔧 What's Already Configured

✅ **Next.js 16** with App Router  
✅ **TypeScript** with strict mode  
✅ **Tailwind CSS** for styling  
✅ **tRPC** for type-safe APIs  
✅ **Drizzle ORM** for database  
✅ **Supabase** clients (browser & server)  
✅ **React Query** for data fetching  
✅ **Radix UI** components ready  
✅ **Zod** for validation  
✅ **Biome** for linting/formatting  

## 📚 Key Files to Know

- **`app/layout.tsx`** - Root layout, includes tRPC provider
- **`lib/trpc/provider.tsx`** - tRPC client setup
- **`server/routers/_app.ts`** - Main API router
- **`db/schema/index.ts`** - Database schemas go here
- **`drizzle.config.ts`** - Drizzle ORM config
- **`.env.local`** - Your secrets (not in git)

## 🎨 Adding Your First Feature

### 1. Create a Database Schema
`db/schema/deals.ts`:
```typescript
import { pgTable, text, timestamp, uuid, numeric } from 'drizzle-orm/pg-core';

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

Export it in `db/schema/index.ts`:
```typescript
export * from './deals';
```

### 2. Generate & Run Migration
```bash
npm run db:generate
npm run db:push
```

### 3. Create a tRPC Router
`server/routers/deals.ts`:
```typescript
import { z } from 'zod';
import { router, publicProcedure } from '@/lib/trpc/init';
import { db } from '@/db';
import { deals } from '@/db/schema';

export const dealsRouter = router({
  getAll: publicProcedure.query(async () => {
    return await db.select().from(deals);
  }),
  
  create: publicProcedure
    .input(z.object({
      title: z.string(),
      amount: z.number(),
    }))
    .mutation(async ({ input }) => {
      return await db.insert(deals).values(input).returning();
    }),
});
```

Add to `server/routers/_app.ts`:
```typescript
import { dealsRouter } from './deals';

export const appRouter = router({
  deals: dealsRouter,
});
```

### 4. Use in a Component
```typescript
'use client';
import { trpc } from '@/lib/trpc/provider';

export function DealsList() {
  const { data, isLoading } = trpc.deals.getAll.useQuery();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      {data?.map(deal => (
        <div key={deal.id}>{deal.title}</div>
      ))}
    </div>
  );
}
```

## 🆘 Troubleshooting

**"Cannot find module" errors**
```bash
npm install
```

**TypeScript errors**
```bash
npm run type-check
```

**Database connection errors**
- Check `.env.local` exists
- Verify Supabase credentials
- Ensure database URL is correct

**tRPC not working**
- Check `app/layout.tsx` has `<TRPCProvider>`
- Verify API route exists at `app/api/trpc/[trpc]/route.ts`

## 📖 Documentation

- **REQUIREMENTS.md** - Full tech stack details
- **SETUP.md** - Complete Phase 0 documentation
- **PHASE_0_SUMMARY.md** - What we built

## 🎉 You're Ready!

Everything is set up and ready to go. Just:
1. Configure your Supabase credentials
2. Run `npm run dev`
3. Start building!

Need help? Check the docs or the tRPC/Drizzle/Supabase documentation.

---

**Happy coding! 🚀**
