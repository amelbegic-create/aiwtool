import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const jsonContent = JSON.stringify(body);

    const blob = await put('bonusi-data.json', jsonContent, {
      access: 'public',
      addRandomSuffix: false, // Ovo znači da uvijek gazi stari fajl (update)
    });

    return NextResponse.json(blob);
  } catch (_error) {
    return NextResponse.json({ error: 'Greška' }, { status: 500 });
  }
}