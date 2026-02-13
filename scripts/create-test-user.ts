import { createAdminClient } from "../lib/supabase/server";

async function main() {
  console.log("Creating test user...");

  const supabase = createAdminClient();
  const email = "admin_test@example.com";
  const password = "password123";

  // Check if user exists first
  const { data: users, error: listError } =
    await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    process.exit(1);
  }

  const existingUser = users.users.find((u) => u.email === email);
  if (existingUser) {
    console.log("Test user already exists:", email);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error("Error creating user:", error);
    process.exit(1);
  }

  console.log("Test user created successfully:", data.user.email);
}

main();
