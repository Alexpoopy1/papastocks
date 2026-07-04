import { getPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ key: getPublicKey() });
  } catch (e) {
    return Response.json({ key: null, error: String(e.message || e) }, { status: 500 });
  }
}
