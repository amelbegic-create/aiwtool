import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hash } from "bcryptjs";

const PASSWORD_RESET_PREFIX = "pwd-reset:";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password || String(password).length < 6) {
      return NextResponse.json({ error: "Token i lozinka (min. 6 znakova) su obavezni." }, { status: 400 });
    }

    const record = await prisma.verificationToken.findFirst({
      where: { token, identifier: { startsWith: PASSWORD_RESET_PREFIX } },
    });

    if (!record || record.expires < new Date()) {
      return NextResponse.json({ error: "Link za reset je istekao. Zatražite novi." }, { status: 400 });
    }

    const email = record.identifier.replace(PASSWORD_RESET_PREFIX, "");
    const hashedPassword = await hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { email }, data: { password: hashedPassword } }),
      prisma.verificationToken.deleteMany({ where: { identifier: record.identifier } }),
    ]);

    return NextResponse.json({ message: "Lozinka je uspješno promijenjena. Možete se prijaviti." }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Greška na serveru." }, { status: 500 });
  }
}
