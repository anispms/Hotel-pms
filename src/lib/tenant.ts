import { cookies } from "next/headers";
import { prisma } from "./db";
import { getCurrentUser } from "./auth";

const PROPERTY_COOKIE = "pms_property";

export type PropertyRecord = Awaited<ReturnType<typeof prisma.property.findFirst>>;

/** All properties the signed-in user's organization can access. */
export async function accessibleProperties() {
  const user = await getCurrentUser();
  if (!user) return [];
  return prisma.property.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
  });
}

/**
 * The property the user is currently operating in. Falls back to the first
 * property in their organization if the cookie is unset or stale. Always
 * constrained to the user's own organization (no cross-tenant access).
 */
export async function getCurrentProperty() {
  const user = await getCurrentUser();
  if (!user) return null;
  const store = await cookies();
  const cookieId = store.get(PROPERTY_COOKIE)?.value;
  const props = await prisma.property.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
  });
  if (props.length === 0) return null;
  return props.find((p) => p.id === cookieId) ?? props[0];
}

/** Non-null current property id; redirects to login if there is no session. */
export async function requirePropertyId(): Promise<string> {
  const prop = await getCurrentProperty();
  if (!prop) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return prop!.id;
}

/** Non-null current property record. */
export async function requireProperty() {
  const prop = await getCurrentProperty();
  if (!prop) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return prop!;
}

/** Switch the active property (server action). Validates org ownership. */
export async function setCurrentProperty(propertyId: string) {
  const user = await getCurrentUser();
  if (!user) return;
  const owned = await prisma.property.findFirst({
    where: { id: propertyId, organizationId: user.organizationId },
  });
  if (!owned) return;
  const store = await cookies();
  store.set(PROPERTY_COOKIE, propertyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
