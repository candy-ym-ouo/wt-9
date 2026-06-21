const { DataSource } = require('typeorm');
const path = require('path');

async function fix() {
  const ds = new DataSource({
    type: 'sqljs',
    location: path.join(process.cwd(), 'theater.db'),
    synchronize: false,
  });
  await ds.initialize();
  const runner = ds.createQueryRunner();

  try {
    await runner.query("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
  } catch (e) { console.log('status column may already exist'); }

  try {
    await runner.query('ALTER TABLE users ADD COLUMN "frozenAt" DATETIME DEFAULT NULL');
  } catch (e) { console.log('frozenAt column may already exist'); }

  try {
    await runner.query('ALTER TABLE users ADD COLUMN "updatedAt" DATETIME DEFAULT NULL');
  } catch (e) { console.log('updatedAt column may already exist'); }

  await runner.query("UPDATE users SET password = 'admin' WHERE username = 'admin'");
  console.log('Admin password reset to admin');

  await ds.destroy();
}

fix().catch(e => { console.error(e.message); process.exit(1); });
