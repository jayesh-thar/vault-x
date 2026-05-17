import knex from '../db/knex';

async function run() {
  try {
    const result = await knex.migrate.rollback();
    const rolled = result[1];
    console.log(
      rolled.length
        ? `Rolled back: ${rolled.join(', ')}`
        : 'Nothing to rollback'
    );
  } catch (err) {
    console.error('Rollback failed:', err);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

run();
