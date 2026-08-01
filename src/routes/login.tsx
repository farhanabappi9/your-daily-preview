import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import logoAsset from "@/assets/af-logo.jpeg.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Ahsan Fashion" },
      { name: "description", content: "Login to your Ahsan Fashion account." },
    ],
  }),
  component: Login,
});

function Login() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-6 flex flex-col items-center gap-2">
            <img
              src={logoAsset.url}
              alt="Ahsan Fashion logo"
              loading="lazy"
              decoding="async"
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-full object-cover ring-2 ring-[color:var(--accent)]/40"
            />
            <span className="font-display text-lg font-bold">
              Ahsan <span className="text-accent">Fashion</span>
            </span>
          </div>
          <h1 className="mb-6 text-center text-2xl font-bold">Login</h1>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <input
              placeholder="Username or email"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <button className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
              Login
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/" className="text-primary">
              Register
            </Link>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
