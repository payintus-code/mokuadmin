import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth";
import { login } from "./actions";

const errorMessageMap: Record<string, string> = {
  invalid_credentials: "Invalid email or password.",
  missing_credentials: "Please enter both email and password."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const currentUser = await getCurrentAppUser();

  if (currentUser) {
    redirect("/");
  }

  const params = await searchParams;
  const errorMessage = params.error ? errorMessageMap[params.error] ?? "Unable to sign in." : null;

  return (
    <main className="stack">
      <section className="card frontdesk-hero">
        <div className="frontdesk-hero-copy">
          <div className="section-kicker">Secure Access</div>
          <h1 className="frontdesk-hero-title">Sign in to Moku Pet Admin</h1>
          <p className="frontdesk-hero-subtitle">Use an approved staff account before accessing customer, booking, and finance data.</p>
        </div>
      </section>

      <section className="panel stack">
        <form className="stack" action={login}>
          <label className="label">
            Email
            <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          </label>

          <label className="label">
            Password
            <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
          </label>

          {errorMessage ? <div className="soft-note">{errorMessage}</div> : null}

          <button className="btn btn-primary" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
