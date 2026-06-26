import { createHmac } from "crypto";
import { prisma } from "./db";

// Canonical domain events the PMS emits. Anything a hotelier can automate on.
export const EVENT_TYPES = [
  "reservation.created",
  "reservation.cancelled",
  "reservation.no_show",
  "guest.created",
  "guest.checked_in",
  "guest.checked_out",
  "folio.charge_posted",
  "payment.recorded",
  "housekeeping.updated",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_LABELS: Record<string, string> = {
  "reservation.created": "Reservation created",
  "reservation.cancelled": "Reservation cancelled",
  "reservation.no_show": "Marked no-show",
  "guest.created": "Guest created",
  "guest.checked_in": "Guest checked in",
  "guest.checked_out": "Guest checked out",
  "folio.charge_posted": "Charge posted",
  "payment.recorded": "Payment recorded",
  "housekeeping.updated": "Housekeeping updated",
};

type DispatchInput = {
  summary: string;
  entity?: string;
  entityId?: string;
  data?: Record<string, unknown>;
};

function subscribed(endpointEvents: string, event: string): boolean {
  if (!endpointEvents || endpointEvents.trim() === "*") return true;
  return endpointEvents
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .includes(event);
}

/**
 * Record a domain event and fan it out to every active, subscribed webhook
 * endpoint (Zapier / Make / custom). Never throws — delivery failures are
 * logged, not propagated, so business operations are never blocked by an
 * integration being down.
 */
export async function dispatchEvent(
  propertyId: string,
  event: EventType,
  input: DispatchInput
): Promise<void> {
  const payload = {
    event,
    propertyId,
    summary: input.summary,
    entity: input.entity ?? null,
    entityId: input.entityId ?? null,
    occurredAt: new Date().toISOString(),
    data: input.data ?? {},
  };

  try {
    await prisma.eventLog.create({
      data: {
        propertyId,
        event,
        entity: input.entity,
        entityId: input.entityId,
        summary: input.summary,
        payload: JSON.stringify(payload),
      },
    });
  } catch {
    // logging must never break the operation
  }

  let endpoints: { id: string; url: string; events: string; secret: string | null }[] = [];
  try {
    endpoints = await prisma.webhookEndpoint.findMany({ where: { active: true, propertyId } });
  } catch {
    return;
  }

  const targets = endpoints.filter((e) => subscribed(e.events, event));
  if (targets.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    targets.map(async (ep) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "HotelX-PMS-Webhooks/1.0",
        "X-PMS-Event": event,
      };
      if (ep.secret) {
        headers["X-PMS-Signature"] =
          "sha256=" + createHmac("sha256", ep.secret).update(body).digest("hex");
      }
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(ep.url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);
        await prisma.webhookDelivery.create({
          data: {
            endpointId: ep.id,
            event,
            status: res.ok ? "SUCCESS" : "FAILED",
            statusCode: res.status,
            error: res.ok ? null : `HTTP ${res.status}`,
          },
        });
      } catch (err) {
        await prisma.webhookDelivery
          .create({
            data: {
              endpointId: ep.id,
              event,
              status: "FAILED",
              error: err instanceof Error ? err.message : "delivery error",
            },
          })
          .catch(() => {});
      }
    })
  );
}
