import { cookies } from "next/headers";
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { prisma } from "./db";

const COOKIE = "pms_session";
const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";

// ── Password hashing (scrypt, no native deps) ──
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const ref = Buffer.from(hash, "hex");
  return test.length === ref.length && timingSafeEqual(test, ref);
}

// ── Session token: userId.signature ──
function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

function makeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const [userId, sig] = token.split(".");
  if (!userId || !sig) return null;
  return sign(userId) === sig ? userId : null;
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const userId = readToken(store.get(COOKIE)?.value);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };
}

/** Roles allowed to manage configuration, integrations and staff. */
export const ADMIN_ROLES = ["ADMIN", "MANAGER"];

/**
 * Guard for pages/actions that require elevated access. Redirects
 * unauthorized users back to the dashboard.
 */
export async function requireRole(allowed: string[]): Promise<SessionUser> {
  const { redirect } = await import("next/navigation");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!allowed.includes(user!.role)) redirect("/?denied=1");
  return user!;
}

export async function login(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) return null;
  const store = await cookies();
  store.set(COOKIE, makeToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
  };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
