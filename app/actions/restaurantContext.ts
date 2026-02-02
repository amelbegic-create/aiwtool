'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

function cookieOptions() {
  return {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dana
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}

export async function switchRestaurant(restaurantId: string) {
  const cookieStore = await cookies();

  cookieStore.set('activeRestaurantId', restaurantId, cookieOptions());

  revalidatePath('/', 'layout');
}

export async function getActiveRestaurantId() {
  const cookieStore = await cookies();
  return cookieStore.get('activeRestaurantId')?.value;
}

/**
 * ✅ NOVO: osiguraj da activeRestaurantId cookie postoji i da je validan.
 * - Ako cookie ne postoji ili nije u listi dozvoljenih restorana → postavi default
 * - Default: preferirani (primary) ako postoji, inače prvi u listi
 *
 * Pozovi ovo u SERVER layout/header komponenti prije rendera switchera / modula.
 */
export async function ensureActiveRestaurantId(params: {
  allowedRestaurantIds: string[];
  preferredRestaurantId?: string;
  allowAll?: boolean; // ako koristiš opciju 'all'
}) {
  const { allowedRestaurantIds, preferredRestaurantId, allowAll = false } = params;

  const cookieStore = await cookies();
  const current = cookieStore.get('activeRestaurantId')?.value;

  // 1) 'all' ako je dozvoljeno
  if (current === 'all' && allowAll) return 'all';

  // 2) ako postoji i validan je → OK
  if (current && allowedRestaurantIds.includes(current)) return current;

  // 3) odaberi default
  const next =
    (preferredRestaurantId && allowedRestaurantIds.includes(preferredRestaurantId)
      ? preferredRestaurantId
      : allowedRestaurantIds[0]) || null;

  if (!next) return null;

  cookieStore.set('activeRestaurantId', next, cookieOptions());
  revalidatePath('/', 'layout');
  return next;
}
