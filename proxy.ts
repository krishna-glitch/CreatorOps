import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Keep auth session fresh for protected app pages and tRPC API calls.
    "/dashboard/:path*",
    "/deals/:path*",
    "/brands/:path*",
    "/conflicts/:path*",
    "/analytics/:path*",
    "/api/trpc/:path*",
  ],
};
