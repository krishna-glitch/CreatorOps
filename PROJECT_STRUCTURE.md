# CreatorOps OS - Project Structure

## Complete Folder Structure

```
Creator-ops/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth-related pages (grouped route)
│   ├── (dashboard)/              # Dashboard pages (grouped route)
│   ├── api/                      # API routes
│   │   └── trpc/[trpc]/         # tRPC API handler
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Home page
│   └── globals.css              # Global styles
│
├── server/                       # Server-side code
│   ├── api/                     # tRPC API
│   │   ├── routers/            # API route handlers
│   │   ├── trpc.ts             # tRPC initialization
│   │   └── root.ts             # Main API router
│   └── infrastructure/          # Infrastructure layer
│       └── database/           # Database layer
│           └── schema/         # Database schemas
│
├── db/                          # Database (legacy, can migrate to server/infrastructure)
│   ├── schema/                 # Drizzle schemas
│   ├── index.ts                # Database client
│   └── migrate.ts              # Migration runner
│
├── components/                  # React components
│   ├── ui/                     # Reusable UI components (Radix)
│   └── [feature]/              # Feature-specific components
│
├── lib/                         # Utilities & configurations
│   ├── supabase/               # Supabase clients
│   ├── trpc/                   # tRPC client setup
│   └── utils.ts                # Helper functions
│
├── types/                       # TypeScript type definitions
│
├── tests/                       # Test files
│   ├── unit/                   # Unit tests
│   └── integration/            # Integration tests
│
├── public/                      # Static assets
│
├── summary_docs/                # Documentation
│   ├── PHASE_0_SUMMARY.md
│   ├── TASK_2_SUMMARY.md
│   └── ...
│
├── tracking_docs/               # Project tracking
│   ├── PROJECT_STATUS.md
│   └── PHASE_CHECKLIST.md
│
├── docs/                        # Additional documentation
│
├── .env.local                   # Environment variables (gitignored)
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── drizzle.config.ts           # Drizzle ORM config
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript config
├── tailwind.config.ts          # Tailwind config
├── biome.json                  # Biome config (linting)
└── README.md                    # Project README
```

## Directory Purposes

### `/app` - Next.js Application
- **Purpose**: All pages, layouts, and client-side routing
- **Structure**: Uses Next.js 14 App Router
- **Key Files**: 
  - `layout.tsx` - Root layout with providers
  - `page.tsx` - Home page
  - API routes in `api/`

### `/server` - Server-Side Code
- **Purpose**: Backend logic, API, database operations
- **Structure**:
  - `api/` - tRPC routers and procedures
  - `infrastructure/` - Database, external services
- **Key Files**:
  - `api/trpc.ts` - tRPC initialization
  - `api/root.ts` - Main API router

### `/components` - React Components
- **Purpose**: Reusable UI components
- **Structure**:
  - `ui/` - Base UI components (buttons, inputs, etc.)
  - Feature folders - Feature-specific components
- **Examples**:
  - `ui/button.tsx`
  - `deals/deal-card.tsx`

### `/lib` - Utilities & Libraries
- **Purpose**: Helper functions, configurations, clients
- **Key Files**:
  - `utils.ts` - Common utilities
  - `supabase/` - Database clients
  - `trpc/` - tRPC client setup

### `/tests` - Test Suite
- **Purpose**: Automated testing
- **Structure**:
  - `unit/` - Unit tests for functions/components
  - `integration/` - Integration tests for features

### `/db` - Database Layer
- **Purpose**: Database schemas and migrations
- **Key Files**:
  - `schema/` - Drizzle ORM schemas
  - `index.ts` - Database client
  - `migrate.ts` - Migration runner

## Naming Conventions

### Files
- **Components**: PascalCase - `DealCard.tsx`
- **Utilities**: camelCase - `formatCurrency.ts`
- **Pages**: lowercase - `page.tsx`, `layout.tsx`
- **Types**: PascalCase - `Deal.ts`, `User.ts`

### Folders
- **Features**: kebab-case - `deal-tracking/`
- **Components**: kebab-case - `ui/`, `deals/`
- **Routes**: lowercase - `dashboard/`, `auth/`

## Import Aliases

```typescript
@/app/*          → app/
@/server/*       → server/
@/components/*   → components/
@/lib/*          → lib/
@/types/*        → types/
@/db/*           → db/
```

## Best Practices

1. **Colocation**: Keep related files together
2. **Separation of Concerns**: Server code in `/server`, UI in `/components`
3. **Type Safety**: Define types in `/types` or colocate with features
4. **Testing**: Mirror structure in `/tests`
5. **Documentation**: README in each major directory

## Migration Notes

- Current `/db` can be migrated to `/server/infrastructure/database`
- Current `/lib/trpc` is for client, `/server/api` is for server
- Keep backward compatibility during migration
