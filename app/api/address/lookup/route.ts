import { NextRequest, NextResponse } from "next/server";

interface GetAddressResult {
  line_1: string;
  line_2: string;
  line_3?: string;
  line_4?: string;
  locality?: string;
  town_or_city: string;
  county?: string;
  country?: string;
  formatted_address?: string[];
}

/**
 * GET /api/address/lookup?postcode=SE16QF
 * Proxies a postcode lookup to getaddress.io.
 * Requires GETADDRESS_API_KEY in env.
 */
export async function GET(req: NextRequest) {
  const postcode = req.nextUrl.searchParams.get("postcode")?.trim();
  if (!postcode) {
    return NextResponse.json({ error: "postcode is required" }, { status: 400 });
  }

  const apiKey = process.env.GETADDRESS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Address lookup not configured" }, { status: 503 });
  }

  const clean = encodeURIComponent(postcode.replace(/\s+/g, "").toUpperCase());
  const url = `https://api.getaddress.io/find/${clean}?api-key=${apiKey}&expand=true&sort=true`;

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });

    if (res.status === 404) {
      return NextResponse.json({ addresses: [] });
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("[address/lookup] getAddress error:", res.status, text);
      return NextResponse.json({ error: "Postcode not found" }, { status: 400 });
    }

    const data = await res.json() as { addresses?: GetAddressResult[]; postcode?: string };
    const addresses = (data.addresses ?? []).map((a) => ({
      line1:    [a.line_1, a.line_2, a.line_3, a.line_4].filter(Boolean).join(", "),
      line2:    "",
      city:     a.town_or_city,
      postcode: data.postcode ?? postcode,
      display:  [a.line_1, a.town_or_city, data.postcode ?? postcode].filter(Boolean).join(", "),
    }));

    return NextResponse.json({ addresses });
  } catch (err) {
    console.error("[address/lookup] fetch error:", err);
    return NextResponse.json({ error: "Address lookup failed" }, { status: 500 });
  }
}
