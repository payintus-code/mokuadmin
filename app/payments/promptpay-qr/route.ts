import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { generatePromptPayQrForAmount } from "@/lib/payments";

export async function POST(request: Request) {
  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { amount?: unknown } | null;
  const amount = Number(body?.amount ?? 0);

  if (Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount is invalid" }, { status: 400 });
  }

  try {
    const qr = await generatePromptPayQrForAmount(amount);
    return NextResponse.json(qr);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate PromptPay QR" }, { status: 400 });
  }
}

