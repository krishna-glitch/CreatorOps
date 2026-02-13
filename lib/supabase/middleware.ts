import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Refreshes the user's auth session and writes updated cookies to the response.
 *
 * Call this from the root middleware on every matched request. It ensures:
 * 1. Expired sessions are refreshed before page loads
 * 2. Updated auth cookies are written to the response
 *
 * Returns the (potentially modified) NextResponse.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error("Missing Supabase environment variables");
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies to the request (for downstream Server Components)
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }

          // Create a new response with the updated request
          supabaseResponse = NextResponse.next({
            request,
          });

          // Write cookies to the response (for the browser)
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: Do NOT use getSession() here.
  // getUser() sends a request to the Supabase auth server to revalidate
  // the token every time, whereas getSession() only reads from local storage
  // and could return stale/tampered data.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
