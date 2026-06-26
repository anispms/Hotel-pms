"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { hashPassword, requireRole, ADMIN_ROLES } from "./auth";
import { dispatchEvent } from "./events";
import { requirePropertyId, setCurrentProperty } from "./tenant";

function s(v: FormDataEntryValue | null): string {
  return (v ?? "").toString().trim();
}

// ── Switch active property ──
export async function switchProperty(formData: FormData) {
  const propertyId = s(formData.get("propertyId"));
  if (propertyId) await setCurrentProperty(propertyId);
  revalidatePath("/", "layout");
  redirect("/");
}

// ── Property settings ──
export async function updateSettings(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const propertyId = await requirePropertyId();
  const data = {
    name: s(formData.get("name")) || "Hotel",
    legalName: s(formData.get("legalName")) || null,
    email: s(formData.get("email")) || null,
    phone: s(formData.get("phone")) || null,
    website: s(formData.get("website")) || null,
    addressLine: s(formData.get("addressLine")) || null,
    city: s(formData.get("city")) || null,
    country: s(formData.get("country")) || null,
    currency: s(formData.get("currency")) || "USD",
    timezone: s(formData.get("timezone")) || "UTC",
    checkInTime: s(formData.get("checkInTime")) || "15:00",
    checkOutTime: s(formData.get("checkOutTime")) || "11:00",
    taxRate: (parseFloat(s(formData.get("taxRate"))) || 0) / 100,
    taxName: s(formData.get("taxName")) || "Room Tax",
    invoicePrefix: s(formData.get("invoicePrefix")) || "INV",
    invoiceFooter: s(formData.get("invoiceFooter")) || null,
  };
  await prisma.property.update({ where: { id: propertyId }, data });
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function completeOnboarding() {
  const propertyId = await requirePropertyId();
  await prisma.property.update({ where: { id: propertyId }, data: { onboardedAt: new Date() } });
  revalidatePath("/onboarding");
  redirect("/");
}

// ── Users / staff ──
export async function createUser(formData: FormData) {
  const admin = await requireRole(ADMIN_ROLES);
  const name = s(formData.get("name"));
  const email = s(formData.get("email")).toLowerCase();
  const role = s(formData.get("role")) || "FRONT_DESK";
  const password = s(formData.get("password")) || "password123";
  if (!name || !email) redirect("/settings/users?error=invalid");
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) redirect("/settings/users?error=exists");
  await prisma.user.create({
    data: { name, email, role, organizationId: admin.organizationId, passwordHash: hashPassword(password) },
  });
  revalidatePath("/settings/users");
  redirect("/settings/users?saved=1");
}

export async function toggleUser(formData: FormData) {
  const admin = await requireRole(ADMIN_ROLES);
  const id = s(formData.get("id"));
  // Only toggle users within the same organization.
  const u = await prisma.user.findFirst({ where: { id, organizationId: admin.organizationId } });
  if (u) await prisma.user.update({ where: { id }, data: { active: !u.active } });
  revalidatePath("/settings/users");
}

// ── Integrations catalog ──
export async function saveIntegration(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const propertyId = await requirePropertyId();
  const key = s(formData.get("key"));
  const name = s(formData.get("name"));
  const category = s(formData.get("category"));
  const enabled = s(formData.get("enabled")) === "on";
  // Collect every config_* field into a JSON blob
  const config: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("config_")) config[k.slice(7)] = v.toString();
  }
  await prisma.integration.upsert({
    where: { propertyId_key: { propertyId, key } },
    create: { propertyId, key, name, category, enabled, config: JSON.stringify(config) },
    update: { name, category, enabled, config: JSON.stringify(config) },
  });
  revalidatePath("/settings/integrations");
  redirect(`/settings/integrations?saved=${key}`);
}

// ── Webhooks (Zapier / Make / custom) ──
export async function createWebhook(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const propertyId = await requirePropertyId();
  const name = s(formData.get("name"));
  const url = s(formData.get("url"));
  const provider = s(formData.get("provider")) || "CUSTOM";
  const selected = formData.getAll("events").map(String).map((e) => e.trim()).filter(Boolean);
  const events = selected.length > 0 ? selected.join(",") : "*";
  const secret = s(formData.get("secret")) || null;
  if (!name || !url) redirect("/settings/integrations?error=webhook");
  await prisma.webhookEndpoint.create({ data: { propertyId, name, url, provider, events, secret } });
  revalidatePath("/settings/integrations");
  redirect("/settings/integrations?saved=webhook");
}

export async function toggleWebhook(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const propertyId = await requirePropertyId();
  const id = s(formData.get("id"));
  const w = await prisma.webhookEndpoint.findFirst({ where: { id, propertyId } });
  if (w) await prisma.webhookEndpoint.update({ where: { id }, data: { active: !w.active } });
  revalidatePath("/settings/integrations");
}

export async function deleteWebhook(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const propertyId = await requirePropertyId();
  const id = s(formData.get("id"));
  const w = await prisma.webhookEndpoint.findFirst({ where: { id, propertyId } });
  if (!w) return;
  await prisma.webhookDelivery.deleteMany({ where: { endpointId: id } });
  await prisma.webhookEndpoint.delete({ where: { id } });
  revalidatePath("/settings/integrations");
}

export async function testWebhook(formData: FormData) {
  await requireRole(ADMIN_ROLES);
  const propertyId = await requirePropertyId();
  // Emitting a real event exercises the full delivery + logging path.
  await dispatchEvent(propertyId, "reservation.created", {
    summary: "Test event from PMS",
    entity: "test",
    entityId: s(formData.get("id")),
    data: { test: true, message: "This is a test delivery triggered from Settings → Integrations." },
  });
  revalidatePath("/settings/integrations");
}
