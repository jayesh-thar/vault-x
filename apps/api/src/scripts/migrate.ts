import knex from '../db/knex';

async function run() {
  try {
    const result = await knex.migrate.latest();
    const ran = result[1];
    console.log(
      ran.length
        ? `Migrations ran: ${ran.join(', ')}`
        : 'Nothing new to migrate'
    );
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

run();
