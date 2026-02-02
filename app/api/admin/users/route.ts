import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { Role } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    const isAdmin =
      role === Role.SYSTEM_ARCHITECT || role === Role.SUPER_ADMIN || role === Role.ADMIN;

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, role: newRole, permissions, restaurantIds } = body;

    // Provjera da li email postoji
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Email već postoji." }, { status: 400 });
    }

    const hashedPassword = await hash(password, 12);

    // Kreiranje korisnika SA restoranima
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: newRole,
        isActive: true,
        permissions: Array.isArray(permissions) ? permissions : [],
        // Magija za povezivanje restorana:
        restaurants: {
          create: restaurantIds?.map((id: string) => ({
            restaurant: { connect: { id } }
          })) || []
        }
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("User creation error:", error);
    return NextResponse.json({ error: "Došlo je do greške." }, { status: 500 });
  }
}