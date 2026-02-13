# CreatorOps OS v2.0 — Technical Specifications & Engineering Standards
**Production-Grade Implementation Guide**

---

## TABLE OF CONTENTS
1. [Architecture & Technology Stack](#architecture--technology-stack)
2. [Code Quality & Standards](#code-quality--standards)
3. [Security & Data Protection](#security--data-protection)
4. [Performance & Scalability](#performance--scalability)
5. [Error Handling & Resilience](#error-handling--resilience)
6. [Database Design](#database-design)
7. [API Design](#api-design)
8. [DevOps & Deployment](#devops--deployment)
9. [Testing Strategy](#testing-strategy)
10. [Monitoring & Observability](#monitoring--observability)
11. [Documentation Requirements](#documentation-requirements)
12. [Developer Experience](#developer-experience)

---

## 1. ARCHITECTURE & TECHNOLOGY STACK

### 1.1 System Architecture
**REQUIRED: Layered Architecture (Hexagonal/Ports & Adapters)**

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Next.js UI  │  │   REST API   │  │  WebSocket   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Use Cases (Business Logic)                          │   │
│  │  - CreateDeal, UpdatePayment, DetectConflicts       │   │
│  │  - CalculateCashFlow, GenerateForecast              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Entities   │  │  Value Objs  │  │   Services   │      │
│  │  (Deal, Pay) │  │  (Currency)  │  │ (RulesEngine)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Redis     │  │   Resend     │      │
│  │  (Supabase)  │  │   (Cache)    │  │   (Email)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Principles:**
- **Dependency Inversion**: Domain layer has ZERO dependencies on outer layers
- **Port & Adapters**: All external integrations via interfaces
- **Single Responsibility**: Each module does ONE thing well
- **Open/Closed**: Open for extension, closed for modification

---

### 1.2 Technology Stack (Mandatory Versions)

#### Backend
```yaml
Runtime: Node.js >= 20.11.0 LTS
Language: TypeScript ^5.3.0
Framework: Next.js 14+ (App Router)
API: tRPC ^10.45.0 (type-safe alternative to REST)
Validation: Zod ^3.22.0
ORM: Drizzle ORM ^0.29.0 (type-safe, performant)
Database: PostgreSQL 15+ (via Supabase)
Cache: Redis 7+ (Upstash for serverless)
Queue: BullMQ ^5.0.0 (Redis-based job queue)
```

#### Frontend
```yaml
Framework: Next.js 14+ (React 18+)
Language: TypeScript ^5.3.0
State: Zustand ^4.5.0 (lightweight, no boilerplate)
Forms: React Hook Form ^7.50.0 + Zod validation
UI: Radix UI primitives + Tailwind CSS ^3.4.0
Charts: Recharts ^2.10.0
Icons: Phosphor Icons ^2.0.0
Date: date-fns ^3.0.0 (tree-shakeable)
```

#### DevOps & Infrastructure
```yaml
Hosting: Vercel (Edge Runtime)
Database: Supabase (managed PostgreSQL + Auth)
Cache: Upstash Redis (serverless)
Email: Resend
Storage: Supabase Storage (S3-compatible)
Monitoring: Sentry + Vercel Analytics
CI/CD: GitHub Actions
```

**WHY these choices:**
- **Next.js 14 App Router**: Server components, streaming, edge runtime
- **tRPC**: End-to-end type safety, no code generation
- **Drizzle ORM**: Fastest TypeScript ORM, SQL-like syntax, type-safe
- **Zod**: Runtime validation + TypeScript inference
- **Zustand**: 10x smaller than Redux, simpler API
- **Supabase**: Managed Postgres, built-in auth, real-time subscriptions

---

## 2. CODE QUALITY & STANDARDS

### 2.1 Absolute Rules (NON-NEGOTIABLE)

#### ❌ FORBIDDEN PRACTICES
```typescript
// ❌ NEVER hardcode values
const API_KEY = "sk_live_abc123"; // FORBIDDEN

// ❌ NEVER use `any` type
function process(data: any) {} // FORBIDDEN

// ❌ NEVER ignore TypeScript errors
// @ts-ignore // FORBIDDEN

// ❌ NEVER use var
var x = 10; // FORBIDDEN

// ❌ NEVER mutate function arguments
function addItem(arr: string[]) {
  arr.push("new"); // FORBIDDEN - mutates input
}

// ❌ NEVER use inline magic numbers
if (status === 3) {} // FORBIDDEN

// ❌ NEVER skip error handling
const data = await fetch(url); // FORBIDDEN - no try/catch

// ❌ NEVER use console.log in production
console.log("Debug info"); // FORBIDDEN - use logger

// ❌ NEVER store secrets in code
const dbPassword = "password123"; // FORBIDDEN
```

#### ✅ REQUIRED PRACTICES
```typescript
// ✅ Environment variables with validation
const config = z.object({
  DATABASE_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']),
}).parse(process.env);

// ✅ Strict typing
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

// ✅ Explicit error handling
try {
  const data = await fetch(url);
} catch (error) {
  logger.error('Fetch failed', { error, url });
  throw new ApiError('Failed to fetch data', 500);
}

// ✅ Constants for magic values
const DealStatus = {
  INBOUND: 'INBOUND',
  NEGOTIATING: 'NEGOTIATING',
  PAID: 'PAID',
} as const;

// ✅ Pure functions
function addItem(arr: string[], item: string): string[] {
  return [...arr, item]; // Returns new array
}

// ✅ Structured logging
logger.info('Deal created', {
  dealId: deal.id,
  brandId: deal.brandId,
  amount: deal.totalValue,
});
```

---

### 2.2 File & Folder Structure

```
creatorops-os/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-preview.yml
│       └── deploy-production.yml
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── deals/
│   │   │   ├── payments/
│   │   │   └── analytics/
│   │   ├── api/
│   │   │   └── trpc/[trpc]/route.ts
│   │   └── layout.tsx
│   ├── server/                       # Backend (tRPC)
│   │   ├── api/
│   │   │   ├── routers/
│   │   │   │   ├── deals.ts
│   │   │   │   ├── payments.ts
│   │   │   │   ├── deliverables.ts
│   │   │   │   └── analytics.ts
│   │   │   ├── root.ts
│   │   │   └── trpc.ts
│   │   ├── domain/                   # Business Logic (Framework-agnostic)
│   │   │   ├── entities/
│   │   │   │   ├── Deal.ts
│   │   │   │   ├── Payment.ts
│   │   │   │   └── Deliverable.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── Currency.ts
│   │   │   │   ├── Money.ts
│   │   │   │   └── DateRange.ts
│   │   │   ├── services/
│   │   │   │   ├── RulesEngine.ts
│   │   │   │   ├── ConflictDetector.ts
│   │   │   │   ├── CashFlowForecaster.ts
│   │   │   │   └── RateBenchmarker.ts
│   │   │   └── repositories/         # Interfaces (Ports)
│   │   │       ├── IDealRepository.ts
│   │   │       └── IPaymentRepository.ts
│   │   ├── infrastructure/           # External Integrations (Adapters)
│   │   │   ├── database/
│   │   │   │   ├── schema.ts         # Drizzle schema
│   │   │   │   ├── migrations/
│   │   │   │   └── repositories/
│   │   │   │       ├── DealRepository.ts
│   │   │   │       └── PaymentRepository.ts
│   │   │   ├── email/
│   │   │   │   └── ResendEmailService.ts
│   │   │   ├── cache/
│   │   │   │   └── RedisCache.ts
│   │   │   └── queue/
│   │   │       └── BullMQQueue.ts
│   │   ├── use-cases/                # Application Logic
│   │   │   ├── CreateDeal.ts
│   │   │   ├── UpdatePayment.ts
│   │   │   ├── DetectConflicts.ts
│   │   │   └── GenerateCashFlowForecast.ts
│   │   └── utils/
│   │       ├── logger.ts
│   │       ├── errors.ts
│   │       └── validation.ts
│   ├── lib/                          # Shared utilities
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── helpers.ts
│   ├── components/                   # React components
│   │   ├── ui/                       # Radix UI primitives
│   │   ├── deals/
│   │   ├── payments/
│   │   └── charts/
│   ├── hooks/                        # Custom React hooks
│   ├── styles/
│   └── config/
│       ├── database.config.ts
│       └── email.config.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/
│   ├── seed.ts
│   └── migrate.ts
├── .env.example
├── .env.local                        # Git-ignored
├── .eslintrc.json
├── .prettierrc
├── tsconfig.json
├── drizzle.config.ts
├── package.json
└── README.md
```

**Naming Conventions:**
- **Files**: `PascalCase.ts` for classes, `camelCase.ts` for utilities
- **Folders**: `kebab-case`
- **Components**: `PascalCase.tsx`
- **Hooks**: `useCamelCase.ts`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`, prefix interfaces with `I` only for ports

---

### 2.3 Code Style Enforcement

#### ESLint Configuration
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "no-console": ["error", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

#### Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

#### TypeScript Configuration (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

---

### 2.4 Git Configuration

#### .gitignore
```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output/

# Next.js
.next/
out/
build/
dist/

# Environment variables
.env
.env.local
.env.*.local
.env.production

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Database
*.db
*.db-journal
postgres-data/

# Logs
logs/
*.log

# Misc
.turbo/
.vercel/
```

#### Git Commit Convention (Conventional Commits)
```
feat: add cash flow forecasting feature
fix: resolve payment currency mismatch bug
docs: update API documentation
style: format code with prettier
refactor: extract rules engine into separate service
test: add unit tests for conflict detection
chore: update dependencies
perf: optimize database queries with indexes
```

**Commit Message Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

---

## 3. SECURITY & DATA PROTECTION

### 3.1 Environment Variables (CRITICAL)

#### .env.example (Committed to Git)
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/creatorops"
DIRECT_URL="postgresql://user:password@localhost:5432/creatorops"

# Authentication (Supabase)
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJxxx"
SUPABASE_SERVICE_ROLE_KEY="eyJxxx"

# Email (Resend)
RESEND_API_KEY="re_xxx"
RESEND_FROM_EMAIL="noreply@creatorops.com"

# Cache (Upstash Redis)
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="Axxx"

# Monitoring (Sentry)
NEXT_PUBLIC_SENTRY_DSN="https://xxx@sentry.io/xxx"
SENTRY_AUTH_TOKEN="sntrys_xxx"

# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS="false"
NEXT_PUBLIC_ENABLE_AI_INSIGHTS="false"
```

#### Environment Variable Validation (src/config/env.ts)
```typescript
import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Authentication
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Email
  RESEND_API_KEY: z.string().regex(/^re_/),
  RESEND_FROM_EMAIL: z.string().email(),

  // Cache
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Monitoring
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']),

  // Feature Flags
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.coerce.boolean().default(false),
  NEXT_PUBLIC_ENABLE_AI_INSIGHTS: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

// Validate at startup
export const env = envSchema.parse(process.env);

// Usage:
// import { env } from '@/config/env';
// const dbUrl = env.DATABASE_URL; // ✅ Type-safe, validated
```

**Environment Files Per Environment:**
- `.env.local` — Local development (git-ignored)
- `.env.development` — Development (git-ignored)
- `.env.production` — Production (Vercel environment variables)
- `.env.test` — Testing (git-ignored)

---

### 3.2 Security Best Practices

#### Authentication & Authorization
```typescript
// Use Supabase Auth (built-in RLS)
import { createServerClient } from '@supabase/ssr';

export async function getUser() {
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // ... cookie handling
  );

  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new UnauthorizedError('User not authenticated');
  }

  return user;
}

// Row-Level Security (RLS) in PostgreSQL
// Example policy: Users can only see their own deals
CREATE POLICY "Users can only access their own deals"
  ON deals
  FOR ALL
  USING (auth.uid() = user_id);
```

#### Input Validation & Sanitization
```typescript
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Zod schema for all inputs
const createDealSchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(1).max(200).trim(),
  totalValue: z.number().positive().finite(),
  currency: z.enum(['USD', 'INR']),
  categories: z.array(z.string()).max(10),
});

// Sanitize HTML inputs
function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  });
}

// Usage in tRPC route
export const createDeal = publicProcedure
  .input(createDealSchema)
  .mutation(async ({ input }) => {
    // Input is already validated by Zod
    const sanitizedTitle = sanitizeHtml(input.title);
    // ... create deal
  });
```

#### SQL Injection Prevention
```typescript
// ✅ ALWAYS use parameterized queries with Drizzle ORM
import { eq } from 'drizzle-orm';

// Safe
const deal = await db.query.deals.findFirst({
  where: eq(deals.id, dealId),
});

// Safe with dynamic filters
const results = await db.select()
  .from(deals)
  .where(
    and(
      eq(deals.userId, userId),
      gte(deals.totalValue, minValue)
    )
  );

// ❌ NEVER construct raw SQL strings
// const query = `SELECT * FROM deals WHERE id = '${dealId}'`; // FORBIDDEN
```

#### XSS Prevention
```typescript
// Use React's built-in XSS protection
function DealTitle({ title }: { title: string }) {
  // React escapes by default
  return <h1>{title}</h1>; // ✅ Safe
  
  // ❌ NEVER use dangerouslySetInnerHTML without sanitization
  // return <h1 dangerouslySetInnerHTML={{ __html: title }} />; // FORBIDDEN
}

// If HTML is needed, sanitize first
import DOMPurify from 'isomorphic-dompurify';

function SafeHtmlContent({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

#### CSRF Protection
```typescript
// Next.js API routes are CSRF-protected by default when using POST/PUT/DELETE
// with proper headers

// Enforce same-origin requests
export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  
  if (origin && new URL(origin).host !== host) {
    return new Response('Forbidden', { status: 403 });
  }
  
  // ... handle request
}
```

#### Rate Limiting
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// 10 requests per 10 seconds per IP
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
});

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 });
  }
  
  // ... handle request
}
```

#### Secrets Management
```typescript
// ✅ Use environment variables for secrets
const apiKey = env.RESEND_API_KEY;

// ✅ For production, use Vercel Environment Variables or AWS Secrets Manager
// NEVER commit secrets to Git
// NEVER log secrets
logger.info('Sending email', {
  to: recipient,
  // apiKey: apiKey, // ❌ FORBIDDEN
});

// ✅ Rotate secrets regularly (quarterly minimum)
// ✅ Use different secrets per environment
```

#### Data Encryption
```typescript
// Encrypt sensitive data at rest (e.g., affiliate codes, payment details)
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32 bytes
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0]!, 'hex');
  const encrypted = parts[1]!;
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Usage: Encrypt before storing in DB
const encryptedCode = encrypt(affiliateCode);
await db.insert(deals).values({
  affiliateCode: encryptedCode,
});
```

---

## 4. PERFORMANCE & SCALABILITY

### 4.1 Database Performance

#### Indexing Strategy
```sql
-- Primary indexes (auto-created)
-- deals(id), payments(id), deliverables(id)

-- Foreign key indexes (CRITICAL for joins)
CREATE INDEX idx_deals_brand_id ON deals(brand_id);
CREATE INDEX idx_deals_user_id ON deals(user_id);
CREATE INDEX idx_payments_deal_id ON payments(deal_id);
CREATE INDEX idx_deliverables_deal_id ON deliverables(deal_id);
CREATE INDEX idx_feedback_deliverable_id ON feedback_items(deliverable_id);

-- Query optimization indexes
CREATE INDEX idx_deals_status_created ON deals(status, created_at DESC);
CREATE INDEX idx_payments_status_due ON payments(status, expected_payment_date);
CREATE INDEX idx_deliverables_scheduled ON deliverables(scheduled_at) 
  WHERE posted_at IS NULL;

-- Partial indexes for common filters
CREATE INDEX idx_active_deals ON deals(user_id, status) 
  WHERE soft_deleted_at IS NULL;

-- Composite indexes for dashboard queries
CREATE INDEX idx_deals_dashboard ON deals(user_id, status, created_at DESC) 
  WHERE soft_deleted_at IS NULL;

-- Full-text search (for deal titles, brand names)
CREATE INDEX idx_deals_search ON deals USING GIN(to_tsvector('english', title));
CREATE INDEX idx_brands_search ON brands USING GIN(to_tsvector('english', name));
```

#### Query Optimization
```typescript
// ❌ N+1 Query Problem
async function getDealsWithPayments() {
  const deals = await db.select().from(deals);
  
  for (const deal of deals) {
    // This executes 1 query per deal!
    deal.payments = await db.select()
      .from(payments)
      .where(eq(payments.dealId, deal.id));
  }
}

// ✅ Use JOIN or prefetch
async function getDealsWithPayments() {
  const results = await db.select({
    deal: deals,
    payment: payments,
  })
  .from(deals)
  .leftJoin(payments, eq(deals.id, payments.dealId))
  .where(eq(deals.userId, userId));
  
  // Group by deal
  const grouped = results.reduce((acc, row) => {
    // ... grouping logic
  }, {});
}

// ✅ Or use Drizzle's relational queries
const dealsWithPayments = await db.query.deals.findMany({
  where: eq(deals.userId, userId),
  with: {
    payments: true,
    deliverables: true,
  },
});
```

#### Pagination
```typescript
// ✅ Cursor-based pagination (better for large datasets)
async function getDeals(cursor?: string, limit = 20) {
  const results = await db.select()
    .from(deals)
    .where(
      cursor 
        ? lt(deals.createdAt, new Date(cursor))
        : undefined
    )
    .orderBy(desc(deals.createdAt))
    .limit(limit + 1); // Fetch 1 extra to determine if there's a next page
  
  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore 
    ? items[items.length - 1]!.createdAt.toISOString()
    : null;
  
  return { items, nextCursor, hasMore };
}
```

#### Database Connection Pooling
```typescript
// Drizzle config with connection pooling
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(env.DATABASE_URL, {
  max: 10, // Maximum connections in pool
  idle_timeout: 20, // Close idle connections after 20s
  connect_timeout: 10, // Connection timeout
});

export const db = drizzle(client);
```

---

### 4.2 Caching Strategy

#### Multi-Layer Caching
```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// Cache keys convention: entity:id:field
// Example: deal:123:details, user:456:stats

class CacheService {
  private readonly TTL = {
    SHORT: 60, // 1 minute (volatile data)
    MEDIUM: 300, // 5 minutes (semi-volatile)
    LONG: 3600, // 1 hour (stable data)
    DAY: 86400, // 24 hours (very stable)
  };

  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data as T | null;
  }

  async set(key: string, value: unknown, ttl: number): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  // Cache-aside pattern
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) return cached;

    const fresh = await fetcher();
    await this.set(key, fresh, ttl);
    return fresh;
  }
}

// Usage
const cache = new CacheService();

async function getDealById(dealId: string) {
  return cache.getOrFetch(
    `deal:${dealId}:details`,
    () => db.query.deals.findFirst({ where: eq(deals.id, dealId) }),
    cache.TTL.MEDIUM
  );
}

// Invalidate cache on updates
async function updateDeal(dealId: string, data: Partial<Deal>) {
  await db.update(deals).set(data).where(eq(deals.id, dealId));
  await cache.invalidate(`deal:${dealId}:*`);
}
```

#### React Query (Frontend Caching)
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch deals with automatic caching
function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: () => api.deals.list.query(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Optimistic updates
function useUpdateDeal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: UpdateDealInput) => api.deals.update.mutate(data),
    onMutate: async (newDeal) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      
      // Snapshot previous value
      const previous = queryClient.getQueryData(['deals']);
      
      // Optimistically update
      queryClient.setQueryData(['deals'], (old: Deal[]) =>
        old.map((deal) => deal.id === newDeal.id ? { ...deal, ...newDeal } : deal)
      );
      
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      queryClient.setQueryData(['deals'], context?.previous);
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });
}
```

---

### 4.3 Frontend Performance

#### Code Splitting & Lazy Loading
```typescript
// ✅ Dynamic imports for heavy components
import dynamic from 'next/dynamic';

const AnalyticsDashboard = dynamic(
  () => import('@/components/analytics/AnalyticsDashboard'),
  {
    loading: () => <Skeleton />,
    ssr: false, // Don't render on server (client-only)
  }
);

// ✅ Lazy load routes
const DealDetails = lazy(() => import('@/app/(dashboard)/deals/[id]/page'));
```

#### Image Optimization
```typescript
import Image from 'next/image';

// ✅ Use Next.js Image component
<Image
  src="/brand-logo.png"
  alt="Brand Logo"
  width={200}
  height={100}
  loading="lazy"
  placeholder="blur"
  blurDataURL="data:image/..." // Low-res placeholder
/>

// ✅ Optimize images at build time
// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
  },
};
```

#### Bundle Size Optimization
```typescript
// ✅ Tree-shaking: Import only what you need
import { format } from 'date-fns'; // ✅
// import * as dateFns from 'date-fns'; // ❌ Imports everything

// ✅ Analyze bundle size
// npm run build
// npx @next/bundle-analyzer

// package.json
{
  "scripts": {
    "analyze": "ANALYZE=true next build"
  }
}
```

#### Memoization & Optimization
```typescript
import { memo, useMemo, useCallback } from 'react';

// ✅ Memoize expensive components
const DealCard = memo(({ deal }: { deal: Deal }) => {
  return <div>{deal.title}</div>;
});

// ✅ Memoize expensive calculations
function DealAnalytics({ deals }: { deals: Deal[] }) {
  const totalRevenue = useMemo(() => {
    return deals.reduce((sum, deal) => sum + deal.totalValue, 0);
  }, [deals]);
  
  return <div>Total: ${totalRevenue}</div>;
}

// ✅ Memoize callbacks to prevent re-renders
function DealList() {
  const handleDealClick = useCallback((dealId: string) => {
    // ... handle click
  }, []);
  
  return deals.map((deal) => (
    <DealCard key={deal.id} deal={deal} onClick={handleDealClick} />
  ));
}
```

---

### 4.4 API Performance

#### Response Compression
```typescript
// Next.js API route with compression
import { NextResponse } from 'next/server';

export async function GET() {
  const data = await fetchLargeDataset();
  
  return NextResponse.json(data, {
    headers: {
      'Content-Encoding': 'gzip', // Auto-handled by Vercel
    },
  });
}
```

#### Streaming Responses (for large datasets)
```typescript
// Stream large CSV exports
export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const deals = await db.select().from(deals);
      
      // Stream CSV row by row
      controller.enqueue('ID,Title,Amount\n');
      for (const deal of deals) {
        controller.enqueue(`${deal.id},${deal.title},${deal.totalValue}\n`);
      }
      
      controller.close();
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="deals.csv"',
    },
  });
}
```

#### Background Jobs (for heavy tasks)
```typescript
import { Queue, Worker } from 'bullmq';

const queue = new Queue('analytics', {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
});

// Enqueue job
await queue.add('calculate-forecast', {
  userId,
  period: '90d',
});

// Worker processes jobs in background
const worker = new Worker('analytics', async (job) => {
  if (job.name === 'calculate-forecast') {
    const forecast = await calculateCashFlowForecast(job.data.userId);
    await saveForecast(forecast);
  }
}, {
  connection: { /* ... */ },
});
```

---

## 5. ERROR HANDLING & RESILIENCE

### 5.1 Structured Error Classes

```typescript
// src/server/utils/errors.ts

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly isOperational = true,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, true, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(
      `External service error: ${service}`,
      502,
      true,
      { service, originalError: originalError?.message }
    );
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, originalError?: Error) {
    super(
      `Database error during ${operation}`,
      500,
      false, // Not operational - needs investigation
      { operation, originalError: originalError?.message }
    );
  }
}
```

---

### 5.2 Global Error Handler

```typescript
// src/server/api/trpc.ts

import * as Sentry from '@sentry/nextjs';

export const createTRPCContext = async (opts: { headers: Headers }) => {
  // ... create context
};

const errorHandler = (error: unknown, ctx: Context) => {
  if (error instanceof AppError) {
    logger.warn('Application error', {
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      userId: ctx.user?.id,
    });
    
    // Don't report operational errors to Sentry
    if (!error.isOperational) {
      Sentry.captureException(error, {
        tags: { type: 'app_error' },
        user: { id: ctx.user?.id },
      });
    }
    
    return {
      message: error.message,
      code: error.statusCode,
      details: error.details,
    };
  }
  
  // Unknown error - log and report
  logger.error('Unexpected error', {
    error,
    userId: ctx.user?.id,
  });
  
  Sentry.captureException(error, {
    tags: { type: 'unknown_error' },
    user: { id: ctx.user?.id },
  });
  
  return {
    message: 'An unexpected error occurred',
    code: 500,
  };
};

export const t = initTRPC.context<typeof createTRPCContext>().create({
  errorFormatter({ error, ctx }) {
    return errorHandler(error, ctx);
  },
});
```

---

### 5.3 Retry Logic with Exponential Backoff

```typescript
// src/lib/retry.ts

interface RetryOptions {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  maxDelay: number;
  factor: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxAttempts,
    initialDelay,
    maxDelay,
    factor,
    onRetry,
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delay = Math.min(
        initialDelay * Math.pow(factor, attempt - 1),
        maxDelay
      );
      
      onRetry?.(lastError, attempt);
      
      logger.warn('Retry attempt', {
        attempt,
        maxAttempts,
        delay,
        error: lastError.message,
      });
      
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Usage
const data = await retry(
  () => fetch('https://api.example.com/data').then(r => r.json()),
  {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    factor: 2,
    onRetry: (error, attempt) => {
      logger.info('Retrying fetch', { error: error.message, attempt });
    },
  }
);
```

---

### 5.4 Circuit Breaker Pattern

```typescript
// src/lib/circuit-breaker.ts

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number; // milliseconds
  monitoringPeriod: number; // milliseconds
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: number;
  private successCount = 0;
  
  constructor(private options: CircuitBreakerOptions) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime! >= this.options.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.warn('Circuit breaker opened', {
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
      });
    }
  }
}

// Usage for external API calls
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  monitoringPeriod: 10000, // 10 seconds
});

async function fetchExternalData() {
  return breaker.execute(() =>
    fetch('https://api.example.com/data').then(r => r.json())
  );
}
```

---

### 5.5 Graceful Degradation

```typescript
// Fallback when external service fails

async function getCurrencyExchangeRate(
  from: string,
  to: string
): Promise<number> {
  try {
    // Try external API first
    const rate = await fetchExchangeRate(from, to);
    return rate;
  } catch (error) {
    logger.warn('Exchange rate API failed, using fallback', {
      from,
      to,
      error: error.message,
    });
    
    // Fallback to cached rate
    const cachedRate = await cache.get(`rate:${from}:${to}`);
    if (cachedRate) return cachedRate;
    
    // Last resort: hardcoded common rates
    const fallbackRates: Record<string, number> = {
      'USD:INR': 83.0,
      'INR:USD': 0.012,
    };
    
    const fallbackRate = fallbackRates[`${from}:${to}`];
    if (fallbackRate) {
      logger.info('Using hardcoded fallback rate', { from, to, fallbackRate });
      return fallbackRate;
    }
    
    throw new ExternalServiceError('Currency exchange service unavailable');
  }
}
```

---

## 6. DATABASE DESIGN

### 6.1 Schema Design (Drizzle ORM)

```typescript
// src/server/infrastructure/database/schema.ts

import { 
  pgTable, 
  uuid, 
  text, 
  timestamp, 
  integer, 
  decimal, 
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table (managed by Supabase Auth)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
}));

// Brands
export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  aliases: jsonb('aliases').$type<string[]>().default([]),
  contactHandles: jsonb('contact_handles').$type<string[]>().default([]),
  notes: text('notes'),
  
  // Performance metrics
  averagePaymentDelayDays: integer('average_payment_delay_days'),
  paymentReliabilityScore: decimal('payment_reliability_score', { precision: 3, scale: 2 }),
  typicalRevisionCount: integer('typical_revision_count'),
  sentimentTrend: text('sentiment_trend'), // POSITIVE | NEUTRAL | NEGATIVE
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  softDeletedAt: timestamp('soft_deleted_at'),
}, (table) => ({
  userIdIdx: index('brands_user_id_idx').on(table.userId),
  nameSearchIdx: index('brands_name_search_idx').using('gin', sql`to_tsvector('english', ${table.name})`),
}));

// Deals
export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  brandId: uuid('brand_id').notNull().references(() => brands.id, { onDelete: 'cascade' }),
  
  title: text('title').notNull(),
  status: text('status').notNull(), // enum: INBOUND, NEGOTIATING, etc.
  contractStatus: text('contract_status').notNull(), // enum: NONE, REQUESTED, etc.
  dealType: text('deal_type').notNull(), // FIXED | AFFILIATE | PERFORMANCE_BONUS | HYBRID
  
  // Dates
  contactReceivedAt: timestamp('contact_received_at'),
  agreedAt: timestamp('agreed_at'),
  
  // Financial
  totalValueOriginal: decimal('total_value_original', { precision: 12, scale: 2 }),
  currencyOriginal: text('currency_original'), // USD | INR | OTHER
  
  // Affiliate
  affiliateCode: text('affiliate_code'),
  affiliateCommissionRate: decimal('affiliate_commission_rate', { precision: 5, scale: 2 }),
  affiliateTrackingUrl: text('affiliate_tracking_url'),
  affiliatePlatform: text('affiliate_platform'),
  
  // Performance Bonus
  performanceBonusStructure: jsonb('performance_bonus_structure').$type<PerformanceBonus[]>(),
  minimumGuarantee: decimal('minimum_guarantee', { precision: 12, scale: 2 }),
  
  // Usage Rights
  usageRightsStartDate: timestamp('usage_rights_start_date'),
  usageRightsEndDate: timestamp('usage_rights_end_date'),
  whitelistingPermitted: boolean('whitelisting_permitted'),
  whitelistingFee: decimal('whitelisting_fee', { precision: 12, scale: 2 }),
  whitelistingDurationDays: integer('whitelisting_duration_days'),
  
  // Revisions
  revisionLimit: integer('revision_limit'),
  revisionsUsed: integer('revisions_used').notNull().default(0),
  additionalRevisionFee: decimal('additional_revision_fee', { precision: 12, scale: 2 }),
  
  deliverablesSummary: text('deliverables_summary'),
  nextAction: text('next_action'),
  nextActionDueAt: timestamp('next_action_due_at'),
  
  riskLevel: text('risk_level').notNull(), // LOW | MED | HIGH
  riskReasons: jsonb('risk_reasons').$type<string[]>(),
  
  tags: jsonb('tags').$type<string[]>().default([]),
  categories: jsonb('categories').$type<string[]>().default([]),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  archivedAt: timestamp('archived_at'),
  softDeletedAt: timestamp('soft_deleted_at'),
}, (table) => ({
  userIdIdx: index('deals_user_id_idx').on(table.userId),
  brandIdIdx: index('deals_brand_id_idx').on(table.brandId),
  statusIdx: index('deals_status_idx').on(table.status),
  dashboardIdx: index('deals_dashboard_idx').on(table.userId, table.status, table.createdAt.desc()),
  titleSearchIdx: index('deals_title_search_idx').using('gin', sql`to_tsvector('english', ${table.title})`),
}));

// Deliverables
export const deliverables = pgTable('deliverables', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id'),
  sequenceNumber: integer('sequence_number'),
  dependsOnDeliverableId: uuid('depends_on_deliverable_id'),
  
  platform: text('platform').notNull(), // INSTAGRAM | YOUTUBE | TIKTOK | OTHER
  type: text('type').notNull(), // REEL | POST | STORY | SHORT | VIDEO
  quantity: integer('quantity').notNull().default(1),
  
  // Platform-specific
  instagramCollabPost: boolean('instagram_collab_post'),
  youtubeShortsPlacement: text('youtube_shorts_placement'), // SHELF | FEED | BOTH
  tiktokCreatorMarketplaceDeal: boolean('tiktok_creator_marketplace_deal'),
  musicLicensingStatus: text('music_licensing_status'), // CLEARED | PENDING | NOT_REQUIRED
  
  // Scheduling
  scheduledAt: timestamp('scheduled_at'),
  postingWindowStart: timestamp('posting_window_start'),
  postingWindowEnd: timestamp('posting_window_end'),
  timezoneOverride: text('timezone_override'),
  timezoneConflictNote: text('timezone_conflict_note'),
  
  postedAt: timestamp('posted_at'),
  postingLink: text('posting_link'),
  
  // Content
  scriptText: text('script_text'),
  captionText: text('caption_text'),
  
  // Approval
  approvalStatus: text('approval_status').notNull(), // PENDING_SUBMISSION | SUBMITTED | APPROVED | REJECTED
  submittedAt: timestamp('submitted_at'),
  approvedAt: timestamp('approved_at'),
  approvedBy: text('approved_by'),
  approvalSlaHours: integer('approval_sla_hours'),
  rejectionReason: text('rejection_reason'),
  
  status: text('status').notNull(), // DRAFT | SCHEDULED | POSTED | CANCELLED
  deadlineState: text('deadline_state').notNull(), // COMPLETED | ON_TRACK | DUE_SOON | LATE
  deadlineStateReason: text('deadline_state_reason'),
  
  // Reschedule history
  rescheduleHistory: jsonb('reschedule_history').$type<RescheduleEvent[]>(),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  softDeletedAt: timestamp('soft_deleted_at'),
}, (table) => ({
  dealIdIdx: index('deliverables_deal_id_idx').on(table.dealId),
  scheduledIdx: index('deliverables_scheduled_idx').on(table.scheduledAt).where(sql`${table.postedAt} IS NULL`),
  campaignIdIdx: index('deliverables_campaign_id_idx').on(table.campaignId),
}));

// Payments
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  
  kind: text('kind').notNull(), // INVOICE_SENT | DEPOSIT | FINAL | INSTALLMENT | AFFILIATE_PAYOUT
  
  // Installments
  installmentNumber: integer('installment_number'),
  totalInstallments: integer('total_installments'),
  installmentSchedule: jsonb('installment_schedule').$type<InstallmentSchedule[]>(),
  
  // Amount
  amountOriginal: decimal('amount_original', { precision: 12, scale: 2 }).notNull(),
  currencyOriginal: text('currency_original').notNull(),
  paymentMethod: text('payment_method'), // PAYPAL | WIRE | VENMO | ZELLE | STRIPE
  paymentMethodFees: decimal('payment_method_fees', { precision: 12, scale: 2 }),
  
  // Tax
  taxWithheld: decimal('tax_withheld', { precision: 12, scale: 2 }),
  grossAmount: decimal('gross_amount', { precision: 12, scale: 2 }),
  netAmount: decimal('net_amount', { precision: 12, scale: 2 }),
  
  // Dates
  paidAt: timestamp('paid_at'),
  invoiceSentAt: timestamp('invoice_sent_at'),
  expectedPaymentDate: timestamp('expected_payment_date'),
  
  // Disputes
  disputeStatus: text('dispute_status').notNull().default('NONE'), // NONE | OPENED | RESOLVED | CHARGEBACK
  disputeReason: text('dispute_reason'),
  disputeOpenedAt: timestamp('dispute_opened_at'),
  disputeResolvedAt: timestamp('dispute_resolved_at'),
  
  // Currency mismatch
  currencyMismatch: boolean('currency_mismatch').default(false),
  currencyReceived: text('currency_received'),
  
  feesOriginal: decimal('fees_original', { precision: 12, scale: 2 }),
  status: text('status').notNull(), // EXPECTED | SENT | PAID | OVERDUE | PARTIAL
  
  // FX
  fxRateUsed: decimal('fx_rate_used', { precision: 10, scale: 6 }),
  fxRateDate: timestamp('fx_rate_date'),
  fxBase: text('fx_base'),
  fxQuote: text('fx_quote'),
  amountUsd: decimal('amount_usd', { precision: 12, scale: 2 }),
  amountInr: decimal('amount_inr', { precision: 12, scale: 2 }),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  softDeletedAt: timestamp('soft_deleted_at'),
}, (table) => ({
  dealIdIdx: index('payments_deal_id_idx').on(table.dealId),
  statusDueIdx: index('payments_status_due_idx').on(table.status, table.expectedPaymentDate),
  paidAtIdx: index('payments_paid_at_idx').on(table.paidAt),
}));

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  entityType: text('entity_type').notNull(), // DEAL | DELIVERABLE | PAYMENT
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(), // CREATED | UPDATED | DELETED | RESTORED
  
  fieldChanged: text('field_changed'),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  
  changedAt: timestamp('changed_at').notNull().defaultNow(),
  changedBy: text('changed_by').notNull(), // USER | SYSTEM
  reason: text('reason'),
  ipAddress: text('ip_address'),
}, (table) => ({
  entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  changedAtIdx: index('audit_logs_changed_at_idx').on(table.changedAt.desc()),
}));

// Relations
export const dealsRelations = relations(deals, ({ one, many }) => ({
  user: one(users, {
    fields: [deals.userId],
    references: [users.id],
  }),
  brand: one(brands, {
    fields: [deals.brandId],
    references: [brands.id],
  }),
  deliverables: many(deliverables),
  payments: many(payments),
}));

export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  deal: one(deals, {
    fields: [deliverables.dealId],
    references: [deals.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  deal: one(deals, {
    fields: [payments.dealId],
    references: [deals.id],
  }),
}));
```

---

### 6.2 Migrations

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';
import { env } from '@/config/env';

export default {
  schema: './src/server/infrastructure/database/schema.ts',
  out: './src/server/infrastructure/database/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
} satisfies Config;

// Generate migration
// npx drizzle-kit generate:pg

// Run migration
// npx drizzle-kit push:pg
```

---

## 7. API DESIGN

### 7.1 tRPC Router Structure

```typescript
// src/server/api/routers/deals.ts

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const dealsRouter = createTRPCRouter({
  // List deals with pagination
  list: protectedProcedure
    .input(z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      status: z.enum(['INBOUND', 'NEGOTIATING', 'PAID']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { cursor, limit, status } = input;
      
      const deals = await ctx.db.query.deals.findMany({
        where: and(
          eq(deals.userId, ctx.user.id),
          status ? eq(deals.status, status) : undefined,
          cursor ? lt(deals.createdAt, new Date(cursor)) : undefined
        ),
        limit: limit + 1,
        orderBy: desc(deals.createdAt),
        with: {
          brand: true,
          deliverables: true,
          payments: true,
        },
      });
      
      const hasMore = deals.length > limit;
      const items = hasMore ? deals.slice(0, -1) : deals;
      const nextCursor = hasMore 
        ? items[items.length - 1]!.createdAt.toISOString()
        : null;
      
      return { items, nextCursor, hasMore };
    }),
  
  // Get single deal
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const deal = await ctx.db.query.deals.findFirst({
        where: and(
          eq(deals.id, input.id),
          eq(deals.userId, ctx.user.id)
        ),
        with: {
          brand: true,
          deliverables: true,
          payments: true,
        },
      });
      
      if (!deal) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deal not found',
        });
      }
      
      return deal;
    }),
  
  // Create deal
  create: protectedProcedure
    .input(z.object({
      brandId: z.string().uuid(),
      title: z.string().min(1).max(200),
      totalValue: z.number().positive(),
      currency: z.enum(['USD', 'INR']),
      dealType: z.enum(['FIXED', 'AFFILIATE', 'PERFORMANCE_BONUS', 'HYBRID']),
      // ... other fields
    }))
    .mutation(async ({ ctx, input }) => {
      const deal = await ctx.db.insert(deals).values({
        userId: ctx.user.id,
        ...input,
      }).returning();
      
      // Create audit log
      await ctx.db.insert(auditLogs).values({
        userId: ctx.user.id,
        entityType: 'DEAL',
        entityId: deal[0]!.id,
        action: 'CREATED',
        changedBy: 'USER',
      });
      
      return deal[0];
    }),
  
  // Update deal
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: z.object({
        title: z.string().optional(),
        status: z.string().optional(),
        // ... other updatable fields
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      // Fetch current deal for audit log
      const currentDeal = await ctx.db.query.deals.findFirst({
        where: and(
          eq(deals.id, input.id),
          eq(deals.userId, ctx.user.id)
        ),
      });
      
      if (!currentDeal) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Deal not found',
        });
      }
      
      // Update deal
      const updated = await ctx.db.update(deals)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(eq(deals.id, input.id))
        .returning();
      
      // Create audit log for each changed field
      for (const [field, newValue] of Object.entries(input.data)) {
        const oldValue = currentDeal[field as keyof typeof currentDeal];
        if (oldValue !== newValue) {
          await ctx.db.insert(auditLogs).values({
            userId: ctx.user.id,
            entityType: 'DEAL',
            entityId: input.id,
            action: 'UPDATED',
            fieldChanged: field,
            oldValue: JSON.stringify(oldValue),
            newValue: JSON.stringify(newValue),
            changedBy: 'USER',
          });
        }
      }
      
      // Invalidate cache
      await ctx.cache.invalidate(`deal:${input.id}:*`);
      
      return updated[0];
    }),
  
  // Soft delete
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(deals)
        .set({ softDeletedAt: new Date() })
        .where(and(
          eq(deals.id, input.id),
          eq(deals.userId, ctx.user.id)
        ));
      
      await ctx.db.insert(auditLogs).values({
        userId: ctx.user.id,
        entityType: 'DEAL',
        entityId: input.id,
        action: 'DELETED',
        changedBy: 'USER',
      });
      
      return { success: true };
    }),
});
```

---

## 8. DEVOPS & DEPLOYMENT

### 8.1 Environment Setup

```bash
# .env.local (development)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/creatorops_dev"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# .env.test (testing)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/creatorops_test"
NODE_ENV="test"

# Production: Use Vercel Environment Variables
# DATABASE_URL → from Supabase
# RESEND_API_KEY → from Resend dashboard
# etc.
```

---

### 8.2 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
  
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: creatorops_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run db:push
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/creatorops_test
      - run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/creatorops_test
  
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: build
          path: .next/
```

```yaml
# .github/workflows/deploy-production.yml

name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

### 8.3 Docker (Optional for Local Development)

```dockerfile
# Dockerfile

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

```yaml
# docker-compose.yml

version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: creatorops_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
  
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/creatorops_dev
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  postgres-data:
```

---

## 9. TESTING STRATEGY

### 9.1 Unit Tests (Vitest)

```typescript
// tests/unit/domain/services/RulesEngine.test.ts

import { describe, it, expect } from 'vitest';
import { RulesEngine } from '@/server/domain/services/RulesEngine';

describe('RulesEngine', () => {
  describe('calculateDeadlineState', () => {
    it('should return COMPLETED when deliverable is posted', () => {
      const result = RulesEngine.calculateDeadlineState({
        scheduledAt: new Date('2025-02-15T10:00:00Z'),
        postedAt: new Date('2025-02-15T09:30:00Z'),
        now: new Date('2025-02-15T12:00:00Z'),
      });
      
      expect(result.state).toBe('COMPLETED');
    });
    
    it('should return LATE when past scheduled time', () => {
      const scheduledAt = new Date('2025-02-15T10:00:00Z');
      const now = new Date('2025-02-15T11:00:00Z');
      
      const result = RulesEngine.calculateDeadlineState({
        scheduledAt,
        postedAt: null,
        now,
      });
      
      expect(result.state).toBe('LATE');
      expect(result.reason).toContain('1 hour');
    });
  });
  
  describe('detectExclusivityConflict', () => {
    it('should detect overlapping category and dates', () => {
      const rule = {
        categoryPath: 'Tech/Smartphones',
        startDate: '2025-03-01',
        endDate: '2025-04-01',
        platforms: ['INSTAGRAM'],
      };
      
      const deliverable = {
        categoryPath: 'Tech/Smartphones',
        scheduledAt: new Date('2025-03-15T10:00:00Z'),
        platform: 'INSTAGRAM',
      };
      
      const conflict = RulesEngine.detectExclusivityConflict(rule, deliverable);
      expect(conflict).toBe(true);
    });
  });
});
```

---

### 9.2 Integration Tests

```typescript
// tests/integration/api/deals.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createCaller } from '@/server/api/root';
import { createTestContext } from '../helpers/context';

describe('Deals Router', () => {
  let caller: ReturnType<typeof createCaller>;
  let userId: string;
  
  beforeAll(async () => {
    const ctx = await createTestContext();
    caller = createCaller(ctx);
    userId = ctx.user.id;
  });
  
  afterAll(async () => {
    // Cleanup test data
  });
  
  it('should create a new deal', async () => {
    const deal = await caller.deals.create({
      brandId: 'test-brand-id',
      title: 'Test Deal',
      totalValue: 1000,
      currency: 'USD',
      dealType: 'FIXED',
    });
    
    expect(deal).toMatchObject({
      title: 'Test Deal',
      totalValue: 1000,
      userId,
    });
  });
  
  it('should throw error when creating deal with invalid data', async () => {
    await expect(
      caller.deals.create({
        brandId: 'invalid',
        title: '',
        totalValue: -100,
        currency: 'USD',
        dealType: 'FIXED',
      })
    ).rejects.toThrow();
  });
});
```

---

### 9.3 E2E Tests (Playwright)

```typescript
// tests/e2e/deals.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Deals Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Login logic
  });
  
  test('should create a new deal', async ({ page }) => {
    await page.click('[data-testid="new-deal-button"]');
    await page.fill('[data-testid="deal-title"]', 'Test Deal');
    await page.fill('[data-testid="deal-amount"]', '1000');
    await page.click('[data-testid="submit-button"]');
    
    await expect(page.locator('text=Deal created successfully')).toBeVisible();
  });
});
```

---

## 10. MONITORING & OBSERVABILITY

### 10.1 Structured Logging (Winston + Pino)

```typescript
// src/server/utils/logger.ts

import pino from 'pino';
import { env } from '@/config/env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'apiKey', 'password'],
    remove: true,
  },
});

// Usage
logger.info('Deal created', {
  dealId: deal.id,
  userId: user.id,
  amount: deal.totalValue,
});

logger.error('Payment failed', {
  dealId: deal.id,
  error: error.message,
  stack: error.stack,
});
```

---

### 10.2 Error Tracking (Sentry)

```typescript
// src/config/sentry.ts

import * as Sentry from '@sentry/nextjs';
import { env } from './env';

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NODE_ENV,
  enabled: env.NODE_ENV === 'production',
  tracesSampleRate: 1.0,
  beforeSend(event, hint) {
    // Filter out non-critical errors
    if (event.exception?.values?.[0]?.value?.includes('NetworkError')) {
      return null;
    }
    return event;
  },
});

// Usage
try {
  await createDeal(data);
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'deals' },
    user: { id: userId },
  });
  throw error;
}
```

---

### 10.3 Performance Monitoring

```typescript
// APM with Vercel Speed Insights
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}

// Custom performance tracking
export function trackPerformance(name: string, fn: () => Promise<void>) {
  const start = performance.now();
  
  return fn().finally(() => {
    const duration = performance.now() - start;
    logger.info('Performance metric', {
      name,
      duration,
    });
  });
}
```

---

## 11. DOCUMENTATION REQUIREMENTS

### 11.1 Code Documentation (TSDoc)

```typescript
/**
 * Calculates cash flow forecast for the next N days
 * 
 * @param userId - The user ID to generate forecast for
 * @param days - Number of days to forecast (30, 60, or 90)
 * @returns Promise<CashFlowForecast> - Forecast data with expected income breakdown
 * 
 * @example
 * ```ts
 * const forecast = await calculateCashFlowForecast('user-123', 30);
 * console.log(forecast.totalExpected); // $5000
 * ```
 * 
 * @throws {ValidationError} If userId is invalid
 * @throws {DatabaseError} If database query fails
 */
export async function calculateCashFlowForecast(
  userId: string,
  days: 30 | 60 | 90
): Promise<CashFlowForecast> {
  // ... implementation
}
```

---

### 11.2 API Documentation (Auto-generated from tRPC)

```typescript
// tRPC auto-generates TypeScript types and OpenAPI docs
// No need for separate Swagger/OpenAPI spec

// Generate OpenAPI spec (optional)
import { generateOpenApiDocument } from 'trpc-openapi';
import { appRouter } from '@/server/api/root';

export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: 'CreatorOps API',
  version: '1.0.0',
  baseUrl: 'https://creatorops.com/api',
});
```

---

### 11.3 README.md

```markdown
# CreatorOps OS

**Production-grade deal tracking & operations management for content creators**

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Run migrations
npm run db:push

# Start development server
npm run dev
\`\`\`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler
- `npm test` - Run tests
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio (database GUI)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.3
- **Database**: PostgreSQL 15 (Supabase)
- **ORM**: Drizzle ORM
- **API**: tRPC
- **Cache**: Redis (Upstash)
- **Email**: Resend
- **Auth**: Supabase Auth
- **UI**: Radix UI + Tailwind CSS

## Architecture

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed architecture docs.

## Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for contribution guidelines.

## License

MIT
\`\`\`

---

## 12. DEVELOPER EXPERIENCE

### 12.1 Pre-commit Hooks (Husky + Lint-Staged)

```json
// package.json
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx lint-staged
npm run type-check
```

---

### 12.2 VS Code Configuration

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-azuretools.vscode-docker",
    "mikestead.dotenv"
  ]
}
```

---

## FINAL CHECKLIST FOR PRODUCTION

### Security ✅
- [ ] All secrets in environment variables
- [ ] Environment variables validated with Zod
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (React escaping + DOMPurify)
- [ ] CSRF protection enabled
- [ ] Rate limiting implemented
- [ ] Data encryption for sensitive fields
- [ ] HTTPS enforced
- [ ] Supabase RLS policies enabled

### Performance ✅
- [ ] Database indexes on all foreign keys
- [ ] Query optimization (no N+1 queries)
- [ ] Cursor-based pagination
- [ ] Redis caching implemented
- [ ] React Query for frontend caching
- [ ] Code splitting & lazy loading
- [ ] Image optimization (Next.js Image)
- [ ] Bundle size < 200KB (gzipped)

### Reliability ✅
- [ ] Error boundaries in React
- [ ] Structured error handling
- [ ] Retry logic with exponential backoff
- [ ] Circuit breaker for external APIs
- [ ] Graceful degradation
- [ ] Database connection pooling

### Monitoring ✅
- [ ] Structured logging (Pino)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring (Vercel Speed Insights)
- [ ] Uptime monitoring
- [ ] Alert thresholds configured

### Testing ✅
- [ ] Unit tests (>80% coverage)
- [ ] Integration tests for critical paths
- [ ] E2E tests for user flows
- [ ] CI/CD pipeline running tests

### DevOps ✅
- [ ] Environment variables per environment
- [ ] Automated migrations
- [ ] GitHub Actions CI/CD
- [ ] Preview deployments (Vercel)
- [ ] Database backups automated
- [ ] Disaster recovery plan

### Code Quality ✅
- [ ] TypeScript strict mode enabled
- [ ] ESLint configured and passing
- [ ] Prettier formatting enforced
- [ ] Pre-commit hooks (Husky)
- [ ] No `any` types
- [ ] No hardcoded values
- [ ] All functions typed
- [ ] TSDoc comments on public APIs

---

**END OF TECHNICAL SPECIFICATIONS**
