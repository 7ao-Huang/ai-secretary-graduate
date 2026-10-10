import { NextResponse } from "next/server";

import { buildEmailDigest } from "@/lib/email-intelligence";

export async function GET() {
  return NextResponse.json(buildEmailDigest());
}
