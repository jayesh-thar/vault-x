import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('users', (table) => {
    table.text('recovery_key_enc').nullable();
    table.text('recovery_key_iv').nullable();
  });
}
export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('users', (table) => {
    table.dropColumn('recovery_key_enc');
    table.dropColumn('recovery_key_iv');
  });
}
