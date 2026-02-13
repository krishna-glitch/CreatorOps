import { pgSchema, uuid } from 'drizzle-orm/pg-core';

// Reference to Supabase Auth schema
// We only declare the minimal shape needed for foreign key references
// The actual users table is fully managed by Supabase Auth
const authSchema = pgSchema('auth');

export const authUsers = authSchema.table('users', {
    id: uuid('id').primaryKey(),
});
