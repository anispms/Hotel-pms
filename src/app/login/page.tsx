import { redirect } from "next/navigation";
import { getCurrentUser, login } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const { error } = await searchParams;

  async function doLogin(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const result = await login(email, password);
    if (!result) redirect("/login?error=1");
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-600 to-brand-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
            H
          </div>
          <div>
            <div className="text-lg font-bold">Hotel X</div>
            <div className="text-xs text-gray-500">Property Management System</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Invalid email or password.
          </div>
        )}

        <form action={doLogin} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" required defaultValue="frontdesk@hotelx.com" className="input" />
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" required defaultValue="password123" className="input" />
          </div>
          <button type="submit" className="btn-primary w-full">
            Sign in
          </button>
        </form>

        <div className="mt-6 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
          <div className="mb-1 font-semibold text-gray-600">Demo accounts (password: password123)</div>
          admin@hotelx.com · manager@hotelx.com · frontdesk@hotelx.com · housekeeping@hotelx.com
        </div>
      </div>
    </div>
  );
}
