# CreatorOps OS - Requirements & Setup

## Project Overview
CreatorOps OS is a deal tracking system for content creators built with modern web technologies.

## Tech Stack

### Core Framework
- **Next.js**: 16.1.6 (App Router)
- **TypeScript**: 5.x
- **React**: 19.2.3

### Backend & Database
- **Supabase**: PostgreSQL + Authentication
- **Drizzle ORM**: 0.45.1
- **tRPC**: 11.0.0 (Type-safe API layer)
- **Zod**: 4.3.6 (Schema validation)

### Frontend & UI
- **Tailwind CSS**: 4.x
- **Radix UI**: Component primitives
  - Dialog, Dropdown Menu, Select, Toast, Slot, Label, Separator
- **Lucide React**: Icon library
- **Class Variance Authority**: Component variants
- **clsx + tailwind-merge**: Utility class management

### Development Tools
- **Biome**: Linting and formatting
- **Drizzle Kit**: Database migrations
- **tsx**: TypeScript execution
- **dotenv-cli**: Environment management

## System Requirements

### Required
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Git**: Latest version

### Recommended
- **VS Code** or similar IDE with TypeScript support
- **Supabase Account** (free tier available)

## Installation

### 1. Clone & Install
```bash
cd /Users/krishnadasyam/Projects/Creator-ops
npm install
```

### 2. Environment Setup
```bash
# Copy the example environment file
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
```

### 3. Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings > API
3. Get your database URL from Settings > Database
4. Update `.env.local` with these values

### 4. Database Setup
```bash
# Generate migrations from schema
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Open Drizzle Studio to view database
npm run db:studio
```

## Development

### Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Run production server |
| `npm run lint` | Run Biome linter |
| `npm run format` | Format code with Biome |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:migrate` | Run migrations programmatically |
| `npm run type-check` | TypeScript type checking |

## Project Structure (Planned)

```
Creator-ops/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth-related pages
│   ├── (dashboard)/       # Dashboard pages
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Radix UI components
│   └── ...               # Feature components
├── db/                    # Database
│   ├── schema/           # Drizzle schemas
│   ├── migrate.ts        # Migration script
│   └── index.ts          # Database client
├── lib/                   # Utilities
│   ├── supabase/         # Supabase clients
│   ├── trpc/             # tRPC setup
│   └── utils.ts          # Helper functions
├── server/                # Server-side code
│   └── routers/          # tRPC routers
├── types/                 # TypeScript types
├── .env.example          # Environment template
├── .env.local            # Local environment (gitignored)
├── drizzle.config.ts     # Drizzle configuration
└── tsconfig.json         # TypeScript config
```

## Next Steps

### Phase 1: Core Setup
- [ ] Configure Drizzle ORM
- [ ] Set up tRPC router structure
- [ ] Configure Supabase auth
- [ ] Create base UI components

### Phase 2: Authentication
- [ ] Implement auth flow
- [ ] Create login/signup pages
- [ ] Set up protected routes
- [ ] Configure session management

### Phase 3: Database Schema
- [ ] Design deal tracking schema
- [ ] Create user profiles schema
- [ ] Set up relationships
- [ ] Generate and run migrations

### Phase 4: Core Features
- [ ] Deal CRUD operations
- [ ] Dashboard implementation
- [ ] Analytics views
- [ ] User settings

## Dependencies Version Summary

```json
{
  "next": "16.1.6",
  "react": "19.2.3",
  "typescript": "^5",
  "drizzle-orm": "^0.45.1",
  "@trpc/server": "^11.0.0",
  "zod": "^4.3.6",
  "tailwindcss": "^4"
}
```

## Support & Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [tRPC Documentation](https://trpc.io)
- [Radix UI Documentation](https://www.radix-ui.com)

## Notes

- This project uses the Next.js App Router (not Pages Router)
- Biome is used instead of ESLint for better performance
- React Compiler is enabled for optimization
- Supabase auth helpers are deprecated; use `@supabase/ssr` for new implementations
