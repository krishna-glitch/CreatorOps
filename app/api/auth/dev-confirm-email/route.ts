import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ConfirmEmailRequest = {
  email?: string;
};

export async function POST(request: Request) {
  let body: ConfirmEmailRequest;
  try {
    body = (await request.json()) as ConfirmEmailRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const admin = createAdminClient();
  const perPage = 200;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) {
      return new Response(
        JSON.stringify({
          error: "Failed to list users",
          details: error.message,
        }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const matchingUser = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email,
    );

    if (matchingUser) {
      if (matchingUser.email_confirmed_at) {
        return new Response(JSON.stringify({ ok: true, confirmed: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      const { error: updateError } = await admin.auth.admin.updateUserById(
        matchingUser.id,
        {
          email_confirm: true,
        },
      );

      if (updateError) {
        return new Response(
          JSON.stringify({
            error: "Failed to confirm email",
            details: updateError.message,
          }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify({ ok: true, confirmed: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (data.users.length < perPage) {
      break;
    }
  }

  return new Response(JSON.stringify({ error: "User not found" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}
