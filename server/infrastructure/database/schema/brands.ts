import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { authUsers } from './auth';
import { deals } from './deals';

export const brands = pgTable('brands', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
        .notNull()
        .references(() => authUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
    return {
        userIdIdx: index('brands_user_id_idx').on(table.userId),
    };
});

// Relations: Brand has many Deals
export const brandsRelations = relations(brands, ({ many }) => ({
    deals: many(deals),
}));
