'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function switchRestaurant(restaurantId: string) {
  // FIX: Dodan 'await' jer je cookies() u novom Next.js-u Promise
  const cookieStore = await cookies();
  
  cookieStore.set('activeRestaurantId', restaurantId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dana
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });

  revalidatePath('/', 'layout');
}

export async function getActiveRestaurantId() {
  const cookieStore = await cookies();
  return cookieStore.get('activeRestaurantId')?.value;
}