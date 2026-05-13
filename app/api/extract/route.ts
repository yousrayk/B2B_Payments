import { GoogleGenerativeAI, type RequestOptions } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

const EXTRACTION_PROMPT = `You are an invoice parser. Extract the following fields from this invoice image and return ONLY valid JSON with no markdown fences or extra text:
{
  "vendor": "the vendor or company name",
  "amount": 0.00,
  "category": "one of: Software, Marketing, Legal, HR, Infrastructure, Office, Travel, Other",
  "due_date": "YYYY-MM-DD or null if not found",
  "confidence_score": 0.00
}
confidence_score is a number between 0 and 1 representing how confident you are in the overall extraction. Use 0.95+ when all fields are clearly visible, 0.75-0.94 when some fields required inference, below 0.75 when the document is unclear or fields are missing.
If a field cannot be determined, use null.`;

function detectMimeType(url: string, contentType: string | null): string {
  if (contentType && contentType.startsWith("image/")) return contentType.split(";")[0];
  if (contentType === "application/pdf") return "application/pdf";
  const lower = url.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const invoiceUrl = (body as Record<string, unknown>)?.invoiceUrl;
  if (typeof invoiceUrl !== "string" || !invoiceUrl.trim()) {
    return NextResponse.json({ error: "invoiceUrl is required" }, { status: 400 });
  }

  // Fetch the invoice image
  let imageBase64: string;
  let mimeType: string;
  try {
    const imageRes = await fetch(invoiceUrl);
    if (!imageRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch invoice: ${imageRes.status} ${imageRes.statusText}` },
        { status: 400 },
      );
    }
    mimeType = detectMimeType(invoiceUrl, imageRes.headers.get("content-type"));
    const buffer = await imageRes.arrayBuffer();
    imageBase64 = Buffer.from(buffer).toString("base64");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown fetch error";
    return NextResponse.json({ error: `Could not fetch invoice image: ${msg}` }, { status: 400 });
  }

  // Call Gemini
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_GENERATIVE_AI_API_KEY is not set" }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel(
    { model: "gemini-2.5-flash" },
    { apiVersion: "v1" } satisfies RequestOptions,
  );

  let extracted: { vendor: string | null; amount: number | null; category: string | null; due_date: string | null; confidence_score: number | null };
  try {
    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      { inlineData: { mimeType, data: imageBase64 } },
    ]);
    const raw = result.response.text().trim();
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    extracted = JSON.parse(jsonText);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown Gemini error";
    return NextResponse.json(
      { error: "Failed to parse Gemini response", detail: msg },
      { status: 422 },
    );
  }

  const amount = typeof extracted.amount === "number" ? extracted.amount : 0;
  const ccFee = parseFloat((amount * 0.029).toFixed(2));
  const a2aFee = 0.50;
  const suggestedRail = ccFee <= a2aFee ? "Credit Card" : "A2A";

  // Persist to Supabase (admin client bypasses RLS for server-side inserts)
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createAdminClient()
    : await createSupabaseServerClient();
  const { data: inserted, error: dbError } = await supabase
    .from("invoices")
    .insert({
      vendor: extracted.vendor ?? "Unknown",
      amount,
      category: extracted.category ?? null,
      due_date: extracted.due_date ?? null,
      suggested_rail: suggestedRail,
      confidence_score: typeof extracted.confidence_score === "number" ? extracted.confidence_score : null,
    })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: inserted.id,
    vendor: inserted.vendor,
    amount: inserted.amount,
    category: inserted.category,
    due_date: inserted.due_date,
    suggested_rail: inserted.suggested_rail,
    confidence_score: inserted.confidence_score,
    cc_fee: ccFee,
    a2a_fee: a2aFee,
  });
}
