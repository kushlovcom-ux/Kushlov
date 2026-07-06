import { Role } from '@kushlov/types';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AdminInstruction, Gift, User } from '../models';
import { hashPassword } from '../utils/password';
import { ensureWallet } from '../services/wallet.service';
import { getSettings } from '../services/settings.service';

/**
 * Idempotent bootstrap seed: ensures a global settings doc, an admin account,
 * a starter gift catalog, and default host-verification instructions exist.
 * Safe to run on every startup.
 */
export async function ensureSeed(): Promise<void> {
  await getSettings(); // creates the global settings document if missing

  // --- Admin account ---
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const existing = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
    if (!existing) {
      const admin = await User.create({
        email: env.ADMIN_EMAIL.toLowerCase(),
        username: 'admin',
        displayName: 'Kushlov Admin',
        password: await hashPassword(env.ADMIN_PASSWORD),
        role: Role.Admin,
      });
      await ensureWallet(admin._id);
      logger.info(`👑 Admin account created: ${env.ADMIN_EMAIL}`);
    }
  }

  // --- Default gift catalog ---
  if ((await Gift.estimatedDocumentCount()) === 0) {
    await Gift.insertMany([
      { name: 'Rose', imageUrl: 'https://cdn.kushlov.app/gifts/rose.png', diamondCost: 10, goldValue: 5, sortOrder: 1 },
      { name: 'Heart', imageUrl: 'https://cdn.kushlov.app/gifts/heart.png', diamondCost: 25, goldValue: 12, sortOrder: 2 },
      { name: 'Teddy', imageUrl: 'https://cdn.kushlov.app/gifts/teddy.png', diamondCost: 50, goldValue: 25, sortOrder: 3 },
      { name: 'Crown', imageUrl: 'https://cdn.kushlov.app/gifts/crown.png', diamondCost: 200, goldValue: 100, sortOrder: 4 },
      { name: 'Sports Car', imageUrl: 'https://cdn.kushlov.app/gifts/car.png', diamondCost: 1000, goldValue: 500, sortOrder: 5 },
    ]);
    logger.info('🎁 Seeded default gift catalog');
  }

  // --- Default host verification instructions ---
  if ((await AdminInstruction.estimatedDocumentCount()) === 0) {
    await AdminInstruction.insertMany([
      { text: 'Look straight into the camera', category: 'selfie', sortOrder: 1 },
      { text: 'Turn your head to the left', category: 'selfie', sortOrder: 2 },
      { text: 'Smile naturally', category: 'selfie', sortOrder: 3 },
      { text: "Hold a paper with today's date and say your name", category: 'video', sortOrder: 4 },
    ]);
    logger.info('📋 Seeded default verification instructions');
  }
}

// Allow running standalone: `pnpm --filter @kushlov/server seed`
if (process.argv[1]?.includes('seed')) {
  (async () => {
    const { connectDatabase, disconnectDatabase } = await import('../config/db');
    await connectDatabase();
    await ensureSeed();
    await disconnectDatabase();
    process.exit(0);
  })();
}
