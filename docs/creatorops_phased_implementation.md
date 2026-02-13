# CreatorOps OS — Phased Implementation Plan
**Incremental Build Strategy for Free Tier + Solo Developer**

---

## PHILOSOPHY: Small Bites, High Quality

**Problem:** Dumping everything at once = overwhelmed LLM = low quality code = bugs
**Solution:** Break into 10-15 small phases, each deliverable in 1-3 days

**Key Principles:**
1. ✅ Each phase is **independently testable**
2. ✅ Each phase **adds value** (not just infrastructure)
3. ✅ Focus on **one thing at a time** (no multi-tasking)
4. ✅ **Free tier friendly** (Supabase Free, Vercel Hobby, Upstash Free)
5. ✅ **Track progress** meticulously (don't get lost)

---

## FREE TIER LIMITS (What We're Working With)

### Supabase Free Tier
- **Database:** 500 MB storage (plenty for MVP)
- **Auth:** Unlimited users
- **Storage:** 1 GB files
- **Bandwidth:** 2 GB/month egress
- **API requests:** Unlimited
- **Paused after 1 week inactivity** (just wake it up)

### Vercel Hobby (Free)
- **Deployments:** Unlimited
- **Build time:** 6,000 minutes/month
- **Bandwidth:** 100 GB/month
- **Serverless functions:** 100 GB-hours
- **Edge functions:** 500k invocations/month

### Upstash Redis Free
- **Storage:** 256 MB
- **Commands:** 10,000/day
- **Bandwidth:** 1 GB/month

### Resend Free
- **Emails:** 3,000/month
- **100 emails/day**

**Verdict:** Free tiers are MORE than enough for solo use! 🎉

---

## TRACKING SYSTEM

We'll maintain **TWO tracking documents**:

### 1. PROJECT_STATUS.md (High-Level Progress)
```markdown
# CreatorOps OS - Project Status

## Current Phase: Phase 3 - Deal Creation
**Started:** 2025-02-14
**Target Completion:** 2025-02-17
**Status:** 🟡 In Progress (60% complete)

## Completed Phases
✅ Phase 0 - Project Setup (2025-02-13)
✅ Phase 1 - Database Schema (2025-02-13)
✅ Phase 2 - Authentication (2025-02-14)

## Upcoming Phases
⏳ Phase 4 - Payment Tracking
⏳ Phase 5 - Deliverable Scheduling
...

## Known Issues
- [ ] Timezone handling needs review (Phase 3)
- [ ] Brand matching fuzzy logic not perfect (Phase 3)

## Decisions Made
- Using Drizzle ORM over Prisma (lighter, faster)
- Using tRPC over REST (type safety)
- Skipping multi-currency for Phase 1 (USD only initially)
```

### 2. PHASE_CHECKLIST.md (Detailed Task Tracking)
```markdown
# Phase 3: Deal Creation - Checklist

## Tasks
- [x] Create Deal entity in schema
- [x] Create tRPC router for deals
- [x] Add input validation with Zod
- [ ] Build Deal creation form UI
- [ ] Add brand dropdown/search
- [ ] Implement deal type selection (FIXED/AFFILIATE/etc)
- [ ] Add error handling
- [ ] Write unit tests
- [ ] Manual testing
- [ ] Deploy to Vercel

## Code Files Created
- ✅ `src/server/infrastructure/database/schema/deals.ts`
- ✅ `src/server/api/routers/deals.ts`
- ⏳ `src/app/(dashboard)/deals/new/page.tsx`

## Tests Written
- ✅ `tests/unit/domain/Deal.test.ts`
- ⏳ `tests/integration/api/deals.test.ts`

## Blockers
- None

## Notes
- Decided to use enum for deal_type instead of freeform text
- Added confidence scoring to deal matching
```

---

## PHASE BREAKDOWN (15 Phases Total)

### 🎯 PHASE 0: Project Setup (1 day)
**Goal:** Get development environment running

**Tasks:**
1. Initialize Next.js 14 project with TypeScript
2. Setup Supabase project (database + auth)
3. Configure Drizzle ORM
4. Setup tRPC
5. Install dependencies (Zod, Tailwind, Radix UI)
6. Create .env.local with all keys
7. Setup ESLint + Prettier
8. Create basic folder structure
9. Test: Can you run `npm run dev` successfully?

**Deliverable:** Working "Hello World" Next.js app with database connection

**Free Tier Impact:** None (just setup)

---

### 🎯 PHASE 1: Database Schema - Core Entities (1 day)
**Goal:** Create database tables for essential entities

**Scope:** Users, Brands, Deals (basic fields only)

**Tasks:**
1. Create schema files:
   - `users.ts` (Supabase Auth handles this, just reference it)
   - `brands.ts` (id, name, user_id, created_at)
   - `deals.ts` (id, brand_id, title, total_value, currency, status, created_at)
2. Create Drizzle migration
3. Push to Supabase: `npx drizzle-kit push:pg`
4. Verify in Supabase dashboard (check tables exist)
5. Create seed script with 2-3 test brands

**Deliverable:** 3 tables in Supabase, seed data populated

**Free Tier Impact:** ~1 KB database storage

**What NOT to include yet:**
- ❌ No deliverables, payments, feedback (those are future phases)
- ❌ No complex fields (revision_limit, affiliate_code, etc.)
- ❌ Keep it minimal: just enough to create a basic deal

---

### 🎯 PHASE 2: Authentication (1 day)
**Goal:** User can sign up, log in, log out

**Tasks:**
1. Setup Supabase Auth client
2. Create `/login` page with email/password
3. Create `/signup` page
4. Create protected route middleware
5. Test: Sign up → Log in → See dashboard → Log out

**Deliverable:** Working auth flow

**Free Tier Impact:** None (Supabase Auth is unlimited)

---

### 🎯 PHASE 3: Deal Creation (Basic) (2 days)
**Goal:** User can manually create a deal via form

**Scope:** Just the basics (brand, title, amount, status)

**Tasks:**
1. Create tRPC `deals.create` mutation
2. Add Zod validation schema
3. Build `/deals/new` form:
   - Brand dropdown (select from existing brands)
   - Deal title (text input)
   - Amount (number input)
   - Currency (dropdown: USD/INR)
   - Status (dropdown: INBOUND/NEGOTIATING/etc)
4. Add error handling (show toast on error)
5. Test: Create 3 different deals
6. Verify in Supabase dashboard (data saved correctly?)

**Deliverable:** Working deal creation form

**Free Tier Impact:** ~10 KB database storage (with test data)

**What NOT to include yet:**
- ❌ No AI parsing of messages (that's Phase 7)
- ❌ No deliverables or payments (future phases)
- ❌ No conflict detection (future phase)
- ❌ Just a simple CRUD form

---

### 🎯 PHASE 4: Deal List & View (1 day)
**Goal:** See all deals, click to view details

**Tasks:**
1. Create tRPC `deals.list` query with pagination
2. Build `/deals` page with deal cards
3. Show: brand name, title, amount, status
4. Add status color coding (green=PAID, yellow=NEGOTIATING, red=OVERDUE)
5. Click deal → navigate to `/deals/[id]`
6. Build deal detail page (show all fields)
7. Test: Create 10 deals, verify pagination works

**Deliverable:** Deal list + detail view

**Free Tier Impact:** None (just reading data)

---

### 🎯 PHASE 5: Brand Management (1 day)
**Goal:** Create, edit, search brands

**Tasks:**
1. Create tRPC `brands.create`, `brands.list`, `brands.update`
2. Build `/brands/new` form
3. Build `/brands` list page
4. Add brand search/filter (by name)
5. Test: Create 5 brands, search for one

**Deliverable:** Brand CRUD

**Free Tier Impact:** ~5 KB database storage

---

### 🎯 PHASE 6: Deliverables Schema & CRUD (2 days)
**Goal:** Add deliverables to database and UI

**Tasks:**
1. Create `deliverables` table schema:
   - id, deal_id, platform, type, quantity, scheduled_at, status
2. Create tRPC `deliverables.create`, `deliverables.list`
3. Update deal detail page to show deliverables
4. Add "Add Deliverable" button → opens form
5. Build deliverable form (platform, type, date picker)
6. Test: Create deal with 3 deliverables

**Deliverable:** Deliverables linked to deals

**Free Tier Impact:** ~20 KB database storage

---

### 🎯 PHASE 7: Message Parsing (AI) (2 days)
**Goal:** Paste message → auto-extract deal info

**THIS IS THE PROMPT INTEGRATION PHASE**

**Tasks:**
1. Create tRPC `ai.parseDealMessage` mutation
2. Call Anthropic API (Claude Sonnet 4.5)
3. Send user message + schema to Claude
4. Parse response → extract brand, amount, deliverables
5. Show preview: "I found: Brand X, $1000, 2 reels. Correct?"
6. User confirms → create deal
7. Test with 5 different message formats

**Deliverable:** AI-powered deal creation

**Free Tier Impact:**
- Anthropic API: ~$0.10 per 100 messages (negligible for solo use)
- You can use prompt caching to reduce costs further

**Prompt Used:** Use **simplified version** of main prompt
```
Extract deal info from this message:
- Brand name
- Total value + currency
- Deliverables (platform, type, quantity)
- Status (INBOUND/NEGOTIATING)

Return JSON only. If uncertain, mark confidence < 0.6.
```

**What NOT to include yet:**
- ❌ No complex rules engine (conflicts, revision limits)
- ❌ No dashboard generation (just JSON parsing)
- ❌ Keep it simple: extract → confirm → save

---

### 🎯 PHASE 8: Payment Tracking (2 days)
**Goal:** Track payments per deal

**Tasks:**
1. Create `payments` table schema
2. Create tRPC `payments.create`, `payments.list`
3. Add payment form to deal detail page
4. Show payment status (EXPECTED/PAID/OVERDUE)
5. Calculate total paid vs expected
6. Test: Create deal, add 2 payments (1 paid, 1 expected)

**Deliverable:** Payment tracking

**Free Tier Impact:** ~15 KB database storage

---

### 🎯 PHASE 9: Dashboard View (2 days)
**Goal:** See overview of all deals, payments, deadlines

**Tasks:**
1. Create `/dashboard` page
2. Show stats cards:
   - Total revenue this month
   - Outstanding payments
   - Upcoming deliverables
3. Show recent deals (last 5)
4. Show overdue items (if any)
5. Use Recharts for simple bar chart (revenue by month)

**Deliverable:** Dashboard homepage

**Free Tier Impact:** None (just aggregation)

---

### 🎯 PHASE 10: Deadline Tracking & Reminders (2 days)
**Goal:** Track deliverable deadlines, show warnings

**Tasks:**
1. Implement deadline_state calculation (ON_TRACK/DUE_SOON/LATE)
2. Add background job (check deadlines daily)
3. Send email reminder if due soon (using Resend)
4. Show red banner on dashboard if anything late
5. Test: Create deliverable due tomorrow, verify reminder sent

**Deliverable:** Automated deadline tracking

**Free Tier Impact:**
- Resend: 1-2 emails/day (well under 100/day limit)

---

### 🎯 PHASE 11: Feedback & Rework Tracking (1 day)
**Goal:** Log brand feedback, track revision cycles

**Tasks:**
1. Create `feedback_items` table
2. Create `rework_cycles` table
3. Add "Add Feedback" button on deliverable
4. Auto-increment rework cycle count
5. Warn if revision limit exceeded
6. Test: Create deliverable, add 2 feedback items

**Deliverable:** Feedback logging

**Free Tier Impact:** ~10 KB database storage

---

### 🎯 PHASE 12: Conflict Detection (2 days)
**Goal:** Detect exclusivity overlaps

**Tasks:**
1. Create `exclusivity_rules` table
2. Create `conflicts` table
3. Implement conflict detection logic (check category + date overlap)
4. Show conflict warning when creating deliverable
5. Test: Create exclusive deal, try to create conflicting deal

**Deliverable:** Conflict detection

**Free Tier Impact:** ~5 KB database storage

---

### 🎯 PHASE 13: Analytics & Insights (2 days)
**Goal:** Show revenue trends, rate benchmarks

**Tasks:**
1. Create analytics queries (revenue by month, by brand, by platform)
2. Build `/analytics` page
3. Add charts (Recharts):
   - Revenue trend (line chart)
   - Top brands (bar chart)
   - Platform breakdown (pie chart)
4. Calculate rate benchmarks per category
5. Test: Seed 50 deals, verify charts render

**Deliverable:** Analytics dashboard

**Free Tier Impact:** None (just aggregation)

---

### 🎯 PHASE 14: Polish & Bug Fixes (2 days)
**Goal:** Make it production-ready

**Tasks:**
1. Add loading states everywhere
2. Add error boundaries
3. Improve mobile responsiveness
4. Add keyboard shortcuts (Cmd+K to search)
5. Fix all known bugs from PROJECT_STATUS.md
6. Write integration tests for critical flows
7. Manual QA: Test every feature end-to-end

**Deliverable:** Polished MVP

---

### 🎯 PHASE 15: Documentation & Deployment (1 day)
**Goal:** Ship it!

**Tasks:**
1. Write README.md (how to run locally)
2. Write DEPLOYMENT.md (how to deploy)
3. Deploy to Vercel production
4. Setup custom domain (optional)
5. Configure environment variables in Vercel
6. Test production deployment
7. Celebrate! 🎉

**Deliverable:** Live app

---

## TOTAL TIMELINE: 25-30 days (4-6 weeks)
**Working solo, 2-3 hours/day**

---

## HOW TO USE THIS PLAN WITH AN LLM

### Step-by-Step Workflow

#### 1. Start of Each Phase
**You say:**
```
I'm starting Phase 3: Deal Creation (Basic).

Current context:
- Completed: Phase 0, 1, 2
- Database tables: users, brands, deals (basic schema only)
- Can authenticate users
- Now I need to build deal creation form

Please help me with:
1. Create tRPC deals.create mutation with Zod validation
2. Only focus on: brand_id, title, total_value, currency, status
3. Keep it simple, no extra fields yet

Show me the code for the tRPC router first.
```

**LLM focuses on:** Just the tRPC mutation, nothing else

---

#### 2. Iterate Within Phase
**You say:**
```
Great! The mutation works. Now help me build the form UI.

Context:
- tRPC mutation is working (tested in console)
- Need form at /deals/new
- Use React Hook Form + Zod for validation
- Use Radix UI for components

Show me just the form component.
```

**LLM focuses on:** Just the form, nothing else

---

#### 3. Test & Validate
**You say:**
```
Form is working! Now help me add error handling.

Current issue:
- If brand_id doesn't exist, app crashes
- Need to show toast notification on error

Show me how to add error boundary + toast.
```

**LLM focuses on:** Just error handling, nothing else

---

#### 4. Mark Complete & Move On
**You update:**
```markdown
## PROJECT_STATUS.md
✅ Phase 3 - Deal Creation (completed 2025-02-17)

## PHASE_CHECKLIST.md
- [x] Create Deal entity in schema
- [x] Create tRPC router for deals
- [x] Add input validation with Zod
- [x] Build Deal creation form UI
- [x] Add brand dropdown/search
- [x] Add error handling
- [x] Manual testing ← ALL DONE
```

---

#### 5. Start Next Phase
**You say:**
```
Phase 3 complete! Starting Phase 4: Deal List & View.

What exists:
- Can create deals (working perfectly)
- Database has ~10 test deals
- Need to show list of all deals with pagination

Help me create tRPC deals.list query with cursor pagination.
Show me only the query, not the UI yet.
```

**LLM focuses on:** Just the query, fresh start

---

## CONTEXT MANAGEMENT STRATEGY

### Problem: LLM Forgets Earlier Code
**Solution:** Feed only relevant context per phase

#### Bad Approach (Overwhelms LLM)
```
Here's my entire codebase:
[pastes 50 files]

Now help me add a button.
```

#### Good Approach (Focused)
```
I need to add a "Delete Deal" button.

Relevant context:
- tRPC router: src/server/api/routers/deals.ts (has create, list, getById)
- Deal detail page: src/app/(dashboard)/deals/[id]/page.tsx

Show me:
1. Add deals.delete mutation to router
2. Add delete button to detail page
3. Confirm dialog before delete
```

---

### Context per Phase Type

#### Backend Phase (Database/API)
**Give LLM:**
- Schema file for the entity
- Related tRPC router
- Zod validation schema

**DON'T give:**
- UI components
- Other routers
- Entire database schema

#### Frontend Phase (UI)
**Give LLM:**
- Component you're editing
- tRPC hooks being used
- Relevant types

**DON'T give:**
- Backend code
- Other unrelated components

#### Integration Phase (AI Parsing)
**Give LLM:**
- Sample messages to parse
- Desired JSON output format
- Main prompt (simplified version)

**DON'T give:**
- Entire technical specs
- Database schema
- UI code

---

## SIMPLIFIED PROMPTS PER PHASE

Instead of using the full 50-page prompt, create **mini-prompts** per phase:

### Phase 7: Message Parsing (Mini-Prompt)
```markdown
You are a deal extraction assistant.

Extract these fields from creator messages:
- brand_name (string)
- total_value (number)
- currency (USD | INR)
- deliverables: [{ platform, type, quantity }]
- status (INBOUND | NEGOTIATING)

Return JSON only.
If uncertain about any field, set confidence < 0.6.

Example:
Input: "Nike wants 2 reels for $1500"
Output:
{
  "brand_name": "Nike",
  "total_value": 1500,
  "currency": "USD",
  "deliverables": [{ "platform": "INSTAGRAM", "type": "REEL", "quantity": 2 }],
  "status": "INBOUND",
  "confidence": 0.85
}
```

**Size:** 200 tokens vs 20,000 tokens (100x smaller!)

---

### Phase 10: Deadline Calculation (Mini-Prompt)
```markdown
Calculate deadline state for deliverable.

Inputs:
- scheduled_at (ISO datetime)
- posted_at (ISO datetime or null)
- now (ISO datetime)

Rules:
- If posted_at exists → COMPLETED
- If scheduled_at is null → ON_TRACK
- If now < scheduled_at - 24h → ON_TRACK
- If now between scheduled_at - 24h and scheduled_at → DUE_SOON
- If now > scheduled_at → LATE

Return:
{
  "deadline_state": "DUE_SOON",
  "reason": "Due in 18 hours"
}
```

**Size:** 150 tokens

---

## ERROR RECOVERY PLAN

### If You Get Stuck

#### Symptom: "I have 5 bugs and don't know where to start"
**Solution:**
1. Stop adding features
2. Open PHASE_CHECKLIST.md
3. Mark current phase as "⚠️ BLOCKED"
4. List all bugs in "Known Issues"
5. Fix bugs ONE AT A TIME
6. Ask LLM: "Help me debug this specific error: [paste error]"

#### Symptom: "LLM is giving terrible code"
**Solution:**
1. You're probably giving too much context
2. Start new chat
3. Give only the specific file you're editing
4. Ask for ONE small change
5. Example: "In this file, add error handling to line 45"

#### Symptom: "I forgot what I'm building"
**Solution:**
1. Open PROJECT_STATUS.md
2. Read "Current Phase"
3. Read phase goal
4. Focus ONLY on that goal

---

## QUALITY GATES (Don't Skip!)

### After Each Phase, Ask:
1. ✅ Does it work? (manual test)
2. ✅ Is data saved correctly? (check Supabase dashboard)
3. ✅ Did I update PROJECT_STATUS.md?
4. ✅ Did I update PHASE_CHECKLIST.md?
5. ✅ Any bugs? (add to Known Issues)

**If any NO → Don't start next phase**

---

## TOOLS TO USE

### For Project Tracking
- **Notion** (free): Great for tracking phases
- **Linear** (free tier): Issue tracking
- **GitHub Projects** (free): Built into GitHub
- **Paper + Pen** (free): Sometimes the best!

### For Code
- **VS Code** (free): Best IDE
- **Cursor** (free tier): AI-powered coding
- **GitHub Copilot** (free for students): Code completion

### For Database
- **Supabase Dashboard** (free): Visual database browser
- **Drizzle Studio** (free): Local DB GUI (`npx drizzle-kit studio`)

### For Testing
- **Postman** (free): Test tRPC routes
- **Playwright** (free): E2E testing

---

## FINAL TIPS

### 1. Commit Often
```bash
git commit -m "Phase 3: Add deal creation form"
git commit -m "Phase 3: Add error handling"
git commit -m "Phase 3: Fix validation bug"
```

**Benefit:** Easy to rollback if something breaks

### 2. One Feature = One Branch
```bash
git checkout -b phase-3-deal-creation
# ... work on phase 3
git checkout main
git merge phase-3-deal-creation
```

### 3. Test in Production Early
- Deploy after Phase 4 (deal list working)
- Catch deployment issues early
- Free on Vercel!

### 4. Don't Optimize Prematurely
- Ugly code that works > Beautiful code that's broken
- Refactor in Phase 14 (polish phase)

### 5. Take Breaks
- Code quality drops when tired
- 2-3 hours/day is plenty
- Better to do 1 phase well than 3 phases poorly

---

## SAMPLE WEEKLY SCHEDULE

### Week 1 (Mon-Fri, 2-3 hrs/day)
- Mon: Phase 0 (setup)
- Tue: Phase 1 (database)
- Wed: Phase 2 (auth)
- Thu: Phase 3 (deal creation) - day 1
- Fri: Phase 3 (deal creation) - day 2

### Week 2
- Mon: Phase 4 (deal list)
- Tue: Phase 5 (brand management)
- Wed: Phase 6 (deliverables) - day 1
- Thu: Phase 6 (deliverables) - day 2
- Fri: Phase 7 (AI parsing) - day 1

### Week 3
- Mon: Phase 7 (AI parsing) - day 2
- Tue: Phase 8 (payments) - day 1
- Wed: Phase 8 (payments) - day 2
- Thu: Phase 9 (dashboard) - day 1
- Fri: Phase 9 (dashboard) - day 2

### Week 4
- Mon: Phase 10 (deadlines) - day 1
- Tue: Phase 10 (deadlines) - day 2
- Wed: Phase 11 (feedback)
- Thu: Phase 12 (conflicts) - day 1
- Fri: Phase 12 (conflicts) - day 2

### Week 5
- Mon: Phase 13 (analytics) - day 1
- Tue: Phase 13 (analytics) - day 2
- Wed: Phase 14 (polish) - day 1
- Thu: Phase 14 (polish) - day 2
- Fri: Phase 15 (deploy)

**Total: 5 weeks, working 2-3 hours/day**

---

## SUCCESS METRICS

### After Each Week, Check:
- ✅ How many phases completed? (target: 3-4/week)
- ✅ Any blockers? (fix before moving on)
- ✅ Is it still fun? (if no, take a break)

### After 5 Weeks:
- ✅ Can you create a deal from a message? (core feature)
- ✅ Can you track payments? (core feature)
- ✅ Can you see deadlines? (core feature)
- ✅ Is it deployed? (shipping = winning)

**If YES to all → You built a real product! 🎉**

---

## NEXT STEPS

1. **Create PROJECT_STATUS.md** in your repo
2. **Create PHASE_CHECKLIST.md** in your repo
3. **Start Phase 0** (project setup)
4. **Tell LLM:** "I'm starting Phase 0. Help me initialize Next.js 14 with TypeScript."

**That's it. One phase at a time. You got this! 💪**

---

**END OF PHASED IMPLEMENTATION PLAN**
