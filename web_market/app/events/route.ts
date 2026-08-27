import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  console.log("Smee event received", {
    receivedAt: new Date().toISOString(),
    payload,
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Bazarek Smee endpoint is ready.",
  });
}
