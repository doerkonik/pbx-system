import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import dataSource from '../data-source';
import { MohClass, User } from '../entities';
import { UserRole } from '../../common/enums';

/**
 * Idempotent seed: creates the initial admin user and a default MoH class.
 * Admin credentials come from env (SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD)
 * with safe development fallbacks. Run: `npm run seed`.
 */
async function run(): Promise<void> {
  await dataSource.initialize();
  console.log('Seed: datasource initialized');

  const userRepo = dataSource.getRepository(User);
  const mohRepo = dataSource.getRepository(MohClass);

  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!123';

  const existingAdmin = await userRepo.findOne({
    where: { username: adminUsername },
  });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await userRepo.save(
      userRepo.create({
        username: adminUsername,
        passwordHash,
        role: UserRole.ADMIN,
        fullName: 'System Administrator',
        isActive: true,
      }),
    );
    console.log(
      `Seed: created admin user "${adminUsername}" (change the password after first login)`,
    );
  } else {
    console.log(`Seed: admin user "${adminUsername}" already exists — skipped`);
  }

  const defaultMoh = process.env.DEFAULT_MOH_CLASS ?? 'default';
  const existingMoh = await mohRepo.findOne({ where: { name: defaultMoh } });
  if (!existingMoh) {
    await mohRepo.save(
      mohRepo.create({
        name: defaultMoh,
        mode: 'files',
        directory: '/var/lib/asterisk/moh',
        format: 'wav',
      }),
    );
    console.log(`Seed: created default MoH class "${defaultMoh}"`);
  } else {
    console.log(`Seed: MoH class "${defaultMoh}" already exists — skipped`);
  }

  await dataSource.destroy();
  console.log('Seed: complete');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
