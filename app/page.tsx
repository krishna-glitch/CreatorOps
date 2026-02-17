import { redirect } from "next/navigation";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const authError = params.error;
  const authErrorCode = params.error_code;

  if (authError || authErrorCode) {
    const forwarded = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        forwarded.set(key, value);
      }
    }

    const query = forwarded.toString();
    redirect(query ? `/login?${query}` : "/login");
  }

  redirect("/dashboard");
}
