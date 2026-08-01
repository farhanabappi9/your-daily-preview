import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listUsersAndRoles, setUserRole, type ManagedUser } from "@/lib/admin.functions";
import { ShieldCheck, Shield, UserCog, UserX } from "lucide-react";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

type Assignment = "super_admin" | "admin" | "staff" | "none";

const LABEL: Record<Assignment, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
  none: "কোনো রোল নেই",
};

function UsersPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsersAndRoles(),
  });
  const [email, setEmail] = useState("");
  const [assignment, setAssignment] = useState<Assignment>("admin");
  const [msg, setMsg] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { email: string; assignment: Assignment }) =>
      setUserRole({ data: input }),
    onSuccess: async (res) => {
      setMsg(`${res.email} → ${LABEL[res.assignment as Assignment]} ✅`);
      setEmail("");
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => setMsg(err?.message ?? "ব্যর্থ হয়েছে"),
  });

  const isSuper = data?.me?.isSuperAdmin ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Users & Roles</h1>
        <p className="text-sm text-muted-foreground">
          ইমেইল দিয়ে super admin / admin / staff রোল যোগ, পরিবর্তন ও রিমুভ করুন।
        </p>
      </div>

      {!isSuper && !isLoading && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          রোল পরিবর্তন শুধুমাত্র Super Admin করতে পারেন। আপনি শুধু দেখতে পারবেন।
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setMsg("");
          mutation.mutate({ email: email.trim(), assignment });
        }}
        className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end"
      >
        <label className="flex-1 text-sm">
          <span className="mb-1 block font-medium">ইমেইল</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">রোল</span>
          <select
            value={assignment}
            onChange={(e) => setAssignment(e.target.value as Assignment)}
            className="w-full rounded-md border px-3 py-2 text-sm sm:w-48"
          >
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="none">রোল রিমুভ</option>
          </select>
        </label>
        <button
          disabled={!isSuper || mutation.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "সেভ হচ্ছে…" : "প্রয়োগ করুন"}
        </button>
      </form>
      {msg && <p className="text-sm">{msg}</p>}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">ইমেইল</th>
              <th className="px-3 py-2">রোল</th>
              <th className="px-3 py-2">Email verified</th>
              <th className="px-3 py-2">শেষ লগইন</th>
              <th className="px-3 py-2">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  লোড হচ্ছে…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-destructive">
                  {(error as any)?.message}
                </td>
              </tr>
            )}
            {(data?.users ?? []).map((u: ManagedUser) => {
              const current: Assignment = u.isSuperAdmin
                ? "super_admin"
                : u.roles.includes("admin")
                  ? "admin"
                  : u.roles.includes("staff")
                    ? "staff"
                    : "none";
              return (
                <tr key={u.userId} className="border-t">
                  <td className="px-3 py-2">{u.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {current === "super_admin" ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : current === "admin" ? (
                        <Shield className="h-3.5 w-3.5" />
                      ) : current === "staff" ? (
                        <UserCog className="h-3.5 w-3.5" />
                      ) : (
                        <UserX className="h-3.5 w-3.5" />
                      )}
                      {LABEL[current]}
                    </span>
                    {u.isPermanent && (
                      <span className="ml-2 text-xs text-muted-foreground">(permanent owner)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {u.emailConfirmed ? (
                      <span className="text-emerald-600">যাচাইকৃত</span>
                    ) : (
                      <span className="text-destructive">যাচাই হয়নি</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      disabled={!isSuper || u.isPermanent}
                      value={current}
                      onChange={(e) =>
                        u.email &&
                        mutation.mutate({
                          email: u.email,
                          assignment: e.target.value as Assignment,
                        })
                      }
                      className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
                      <option value="none">রোল রিমুভ</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
