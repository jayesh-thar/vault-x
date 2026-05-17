import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('vault_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('vault_id')
      .references('id')
      .inTable('vaults')
      .onDelete('CASCADE')
      .notNullable();
    t.string('type', 50).notNullable(); // 'login' | 'note' | 'card'
    t.text('encrypted_data').notNullable();
    t.text('iv').notNullable();
    t.string('category', 100);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('deleted_at', { useTz: true }); // soft delete
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('vault_items');
}
