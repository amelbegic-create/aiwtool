import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { hasPermission } from "@/lib/permissionCheck";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { role: true, permissions: true, isActive: true },
  });
  if (!dbUser?.isActive) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasPermission(String(dbUser.role), dbUser.permissions || [], "dashboard_docs:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async () => {
      return {
        allowedContentTypes: ["application/pdf"],
        maximumSizeInBytes: MAX_PDF_BYTES,
        tokenPayload: JSON.stringify({}),
      };
    },
    onUploadCompleted: async () => {
      // no-op: DB update is handled separately after client gets blob.url
    },
  });

  return NextResponse.json(jsonResponse);
}

