import { NextResponse } from "next/server";
import { getLaborData, saveLaborData } from "@/app/actions/laborActions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { year, month, restaurant, data } = body;
    if (!year || !month || !restaurant) {
      return NextResponse.json(
        { success: false, error: "Parameter fehlen." },
        { status: 400 }
      );
    }
    const result = await saveLaborData(
      String(restaurant),
      Number(month),
      Number(year),
      data ?? { inputs: {}, rows: [] }
    );
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Labor POST:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Speichern." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const restaurant = searchParams.get("restaurant");

  if (!year || !month || !restaurant) {
    return NextResponse.json(
      { success: false, error: "Parameter fehlen." },
      { status: 400 }
    );
  }

  try {
    const report = await getLaborData(restaurant, month, year);
    const data = report?.data ?? null;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Labor GET:", error);
    return NextResponse.json(
      { success: false, error: "Fehler beim Laden." },
      { status: 500 }
    );
  }
}
