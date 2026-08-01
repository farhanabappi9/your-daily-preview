import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin, getAccountStatusFn, repairPrimaryAdmin } from "@/lib/admin.functions";
import logoAsset from "@/assets/af-logo.jpeg.asset.json";
import { PRIMARY_ADMIN_EMAIL, SUPER_ADMIN_SETUP_SQL } from "@/lib/super-admin-sql";

import {
  BarChart3,
  Image as ImageIcon,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Settings as SettingsIcon,
  ShoppingBag,
  Tag,
  Users,
  Boxes,
  FileText,
  LineChart,
  ShieldCheck,

} from "lucide-react";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Panel — Ahsan Fashion" },
      { name: "description", content: "Ahsan Fashion shop management panel." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const NAV: { to: any; label: string; icon: any; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/categories", label: "Categories", icon: LayoutGrid },
  { to: "/admin/coupons", label: "Coupons", icon: Tag },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/banners", label: "Banners", icon: ImageIcon },
  { to: "/admin/reports", label: "Reports", icon: LineChart },
  { to: "/admin/content", label: "Content & Invoice", icon: FileText },
  { to: "/admin/users", label: "Users & Roles", icon: ShieldCheck },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },

];

function AdminLayout() {
  const [session, setSession] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const roleQuery = useQuery({
    queryKey: ["am-i-admin", session?.user?.id],
    queryFn: () => amIAdmin(),
    enabled: !!session,
  });

  if (!ready) return <CenterBox>লোড হচ্ছে…</CenterBox>;
  if (!session) return <AdminLogin />;
  if (roleQuery.isLoading) return <CenterBox>যাচাই করা হচ্ছে…</CenterBox>;
  if (roleQuery.isError) {
    return <CenterBox>Admin access যাচাই করা যায়নি। আবার login করুন।</CenterBox>;
  }
  if (!roleQuery.data?.isAdmin)
    return (
      <NotAdmin email={session.user.email} setupMissing={roleQuery.data?.setupMissing ?? true} />
    );


  return (
    <div className="flex min-h-screen w-full bg-muted/30">
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 max-w-[80vw] shrink-0 flex-col overflow-y-auto border-r bg-card transition-transform md:static md:w-60 md:max-w-none md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <img src={logoAsset.url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          <div className="min-w-0">
            <div className="font-display text-sm font-bold">Ahsan Fashion</div>
            <div className="text-xs text-muted-foreground">Admin Panel</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-1 p-3">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            🏠 View Website
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
          <button onClick={() => setOpen((o) => !o)} aria-label="Menu" className="p-1">
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate font-semibold">Admin Panel</span>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function CenterBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function NotAdmin({ email, setupMissing }: { email?: string; setupMissing?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-lg border bg-card p-6 text-center">
        <h1 className="mb-2 text-lg font-bold">অ্যাক্সেস নেই</h1>
        <p className="mb-4 text-sm text-muted-foreground">{email} অ্যাকাউন্টটি admin নয়।</p>
        {setupMissing && <SetupSqlPanel />}
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-3 w-full rounded-md border py-2 text-sm"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

function SetupSqlPanel() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-3 rounded-md border bg-muted/40 p-3 text-left">
      <p className="mb-2 text-xs">
        একবারের সেটআপ বাকি: নিচের SQL কপি করে Supabase → SQL Editor-এ run করুন। এরপর{" "}
        <b>{PRIMARY_ADMIN_EMAIL}</b> স্থায়ীভাবে Super Admin থাকবে (যেকোনো domain-এ)।
      </p>
      <textarea
        readOnly
        value={SUPER_ADMIN_SETUP_SQL}
        className="h-40 w-full rounded border bg-background p-2 font-mono text-[10px]"
      />
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(SUPER_ADMIN_SETUP_SQL);
          setCopied(true);
        }}
        className="mt-2 w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground"
      >
        {copied ? "কপি হয়েছে ✅" : "SQL কপি করুন"}
      </button>
    </div>
  );

}

function AdminLogin() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<any>(null);

  const checkStatus = async (value: string) => {
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setStatus(null);
      return;
    }
    try {
      setStatus(await getAccountStatusFn({ data: { email: value } }));
    } catch {
      setStatus(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMsg(error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth/callback" },
        });
        if (error) setMsg(error.message);
        else if (!data.session) setMsg("ইমেইলে পাঠানো লিংকে ক্লিক করে অ্যাকাউন্ট নিশ্চিত করুন।");
      }
    } finally {
      setBusy(false);
    }
  };

  const sendMagicLink = async () => {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/auth/callback" },
    });
    setMsg(error ? error.message : "ইমেইলে লিংক পাঠানো হয়েছে — একই ব্রাউজারে খুলুন।");
    setBusy(false);
  };

  const repair = async () => {
    setBusy(true);
    setMsg("");
    const res = await repairPrimaryAdmin();
    setMsg(
      res.ok
        ? `Owner অ্যাকাউন্ট ঠিক করা হয়েছে — এখন পাসওয়ার্ড দিয়ে লগইন করুন।`
        : `Repair ব্যর্থ: ${res.error}`,
    );
    await checkStatus(email);
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img
            src={logoAsset.url}
            alt="Ahsan Fashion"
            className="h-16 w-16 rounded-full object-cover"
          />
          <span className="font-display text-lg font-bold">Admin Panel</span>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => void checkStatus(e.target.value)}
            placeholder="ইমেইল"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="পাসওয়ার্ড"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <button
            disabled={busy}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {mode === "login" ? "Login" : "Create account"}
          </button>
        </form>

        {status?.isPrimaryAdmin && (
          <div className="mt-4 space-y-1 rounded-md border bg-muted/40 p-3 text-xs">
            <div className="font-semibold">Owner account status</div>
            <div>অ্যাকাউন্ট: {status.exists ? "আছে ✅" : "নেই ❌"}</div>
            <div>Email verified: {status.emailConfirmed ? "হ্যাঁ ✅" : "না ❌"}</div>
            <div>Admin role: {status.isAdmin ? "সক্রিয় ✅" : "নেই ❌"}</div>
            {(!status.exists || !status.emailConfirmed || !status.isAdmin) && (
              <button
                type="button"
                onClick={repair}
                disabled={busy}
                className="mt-2 w-full rounded-md border py-2 font-semibold disabled:opacity-50"
              >
                Owner অ্যাকাউন্ট ঠিক করুন (verify + admin role)
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={sendMagicLink}
          disabled={busy || !email}
          className="mt-3 w-full rounded-md border py-2 text-xs disabled:opacity-50"
        >
          ইমেইল লিংক দিয়ে লগইন করুন
        </button>

        {msg && <p className="mt-3 text-xs text-destructive">{msg}</p>}
        <button
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:underline"
        >
          {mode === "login" ? "নতুন admin অ্যাকাউন্ট তৈরি করুন" : "লগইন করুন"}
        </button>
      </div>
    </div>
  );
}

