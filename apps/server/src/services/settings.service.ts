import { Settings, ISettings } from '../models';

/** Fetch (or lazily create) the single global settings document. */
export async function getSettings(): Promise<ISettings> {
  let settings = await Settings.findOne({ key: 'global' });
  if (!settings) {
    settings = await Settings.create({
      key: 'global',
      diamondPackages: [
        { id: 'starter', label: 'Starter', diamonds: 100, bonus: 0, price: 0.99, priceUsd: 0.99, priceInr: 79, currency: 'USD', isActive: true },
        { id: 'popular', label: 'Popular', diamonds: 550, bonus: 50, price: 4.99, priceUsd: 4.99, priceInr: 399, currency: 'USD', isActive: true },
        { id: 'pro', label: 'Pro', diamonds: 1200, bonus: 200, price: 9.99, priceUsd: 9.99, priceInr: 799, currency: 'USD', isActive: true },
        { id: 'whale', label: 'Elite', diamonds: 6500, bonus: 1500, price: 49.99, priceUsd: 49.99, priceInr: 3999, currency: 'USD', isActive: true },
      ],
      landing: {
        membersLabel: '120k+',
        verifiedHostsLabel: '8k+',
        liveRoomsLabel: '24/7',
      },
    });
  }
  return settings;
}
