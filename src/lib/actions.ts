"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { nightsBetween, dateOnly, TAX_RATE, rangesOverlap, folioBalance } from "./domain";
import { dispatchEvent } from "./events";
import { requirePropertyId } from "./tenant";

function s(v: FormDataEntryValue | null): string {
  return (v ?? "").toString().trim();
}

// ─────────────────────────────────────────────────────────────
// Reservations
// ─────────────────────────────────────────────────────────────
async function nextConfirmation(): Promise<string> {
  const count = await prisma.reservation.count();
  return "HX-" + (2000 + count).toString(36).toUpperCase().padStart(6, "0");
}

export async function createReservation(formData: FormData) {
  const guestId = s(formData.get("guestId"));
  const roomTypeId = s(formData.get("roomTypeId"));
  const checkIn = dateOnly(s(formData.get("checkIn")));
  const checkOut = dateOnly(s(formData.get("checkOut")));
  const ratePerNight = parseFloat(s(formData.get("ratePerNight"))) || 0;
  const propertyId = await requirePropertyId();

  // Ensure the chosen guest & room type belong to this property (no cross-tenant).
  const [guestOk, typeOk] = await Promise.all([
    prisma.guest.findFirst({ where: { id: guestId, propertyId }, select: { id: true } }),
    prisma.roomType.findFirst({ where: { id: roomTypeId, propertyId }, select: { id: true } }),
  ]);
  if (!guestOk || !typeOk || nightsBetween(checkIn, checkOut) < 1) {
    redirect("/reservations/new?error=invalid");
  }

  const resv = await prisma.reservation.create({
    data: {
      propertyId,
      confirmation: await nextConfirmation(),
      guestId,
      roomTypeId,
      checkIn,
      checkOut,
      adults: parseInt(s(formData.get("adults"))) || 1,
      children: parseInt(s(formData.get("children"))) || 0,
      ratePerNight,
      source: s(formData.get("source")) || "DIRECT",
      notes: s(formData.get("notes")) || null,
      status: "BOOKED",
    },
    include: { guest: true, roomType: true },
  });

  await dispatchEvent(propertyId, "reservation.created", {
    summary: `New booking ${resv.confirmation} for ${resv.guest.firstName} ${resv.guest.lastName}`,
    entity: "reservation",
    entityId: resv.id,
    data: {
      confirmation: resv.confirmation,
      guest: `${resv.guest.firstName} ${resv.guest.lastName}`,
      roomType: resv.roomType.name,
      checkIn: resv.checkIn,
      checkOut: resv.checkOut,
      ratePerNight: resv.ratePerNight,
    },
  });

  revalidatePath("/reservations");
  revalidatePath("/");
  redirect(`/reservations/${resv.id}`);
}

export async function cancelReservation(formData: FormData) {
  const id = s(formData.get("id"));
  const propertyId = await requirePropertyId();
  const found = await prisma.reservation.findFirst({ where: { id, propertyId } });
  if (!found) redirect("/reservations");
  const resv = await prisma.reservation.update({ where: { id }, data: { status: "CANCELLED", roomId: null } });
  await dispatchEvent(propertyId, "reservation.cancelled", {
    summary: `Reservation ${resv.confirmation} cancelled`,
    entity: "reservation",
    entityId: id,
    data: { confirmation: resv.confirmation },
  });
  revalidatePath(`/reservations/${id}`);
  revalidatePath("/reservations");
  revalidatePath("/front-desk");
}

export async function markNoShow(formData: FormData) {
  const id = s(formData.get("id"));
  const propertyId = await requirePropertyId();
  const found = await prisma.reservation.findFirst({ where: { id, propertyId } });
  if (!found) redirect("/reservations");
  const resv = await prisma.reservation.update({ where: { id }, data: { status: "NO_SHOW", roomId: null } });
  await dispatchEvent(propertyId, "reservation.no_show", {
    summary: `Reservation ${resv.confirmation} marked no-show`,
    entity: "reservation",
    entityId: id,
    data: { confirmation: resv.confirmation },
  });
  revalidatePath(`/reservations/${id}`);
  revalidatePath("/front-desk");
}

// ── Check-in: assign room, post room+tax charges, open folio ──
export async function checkIn(formData: FormData) {
  const id = s(formData.get("id"));
  const roomId = s(formData.get("roomId"));
  const propertyId = await requirePropertyId();
  if (!roomId) redirect(`/reservations/${id}?error=noroom`);

  const resv = await prisma.reservation.findFirst({ where: { id, propertyId } });
  if (!resv) redirect("/reservations");
  // Room must belong to the same property.
  const roomOk = await prisma.room.findFirst({ where: { id: roomId, propertyId }, select: { id: true } });
  if (!roomOk) redirect(`/reservations/${id}?error=noroom`);

  const n = nightsBetween(resv!.checkIn, resv!.checkOut);

  // Use the property's configured tax rate & name (fall back to the default).
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  const taxRate = property?.taxRate ?? TAX_RATE;
  const taxName = property?.taxName ?? "Room Tax";
  const taxLabel = `${taxName} (${Math.round(taxRate * 100)}%)`;

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id },
      data: { status: "CHECKED_IN", roomId },
    });
    await tx.room.update({ where: { id: roomId }, data: { hkStatus: "DIRTY" } });

    // open folio + post room charges for each night if not already present
    const folio = await tx.folio.upsert({
      where: { reservationId: id },
      create: { reservationId: id },
      update: {},
    });
    const existing = await tx.folioItem.count({ where: { folioId: folio.id, category: "ROOM" } });
    if (existing === 0) {
      for (let d = 0; d < n; d++) {
        const night = new Date(resv!.checkIn);
        night.setDate(night.getDate() + d);
        await tx.folioItem.create({
          data: {
            folioId: folio.id,
            kind: "CHARGE",
            category: "ROOM",
            description: `Room charge — ${night.toISOString().slice(0, 10)}`,
            amount: resv!.ratePerNight,
            postedAt: night,
          },
        });
        await tx.folioItem.create({
          data: {
            folioId: folio.id,
            kind: "CHARGE",
            category: "TAX",
            description: taxLabel,
            amount: Math.round(resv!.ratePerNight * taxRate * 100) / 100,
            postedAt: night,
          },
        });
      }
    }
  });

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  await dispatchEvent(propertyId, "guest.checked_in", {
    summary: `${resv!.confirmation} checked in to room ${room?.number ?? roomId}`,
    entity: "reservation",
    entityId: id,
    data: { confirmation: resv!.confirmation, room: room?.number },
  });

  revalidatePath(`/reservations/${id}`);
  revalidatePath("/front-desk");
  revalidatePath("/rooms");
  revalidatePath("/");
}

// ── Check-out: requires zero balance, frees room (dirty) ──
export async function checkOut(formData: FormData) {
  const id = s(formData.get("id"));
  const propertyId = await requirePropertyId();
  const resv = await prisma.reservation.findFirst({
    where: { id, propertyId },
    include: { folio: { include: { items: true } } },
  });
  if (!resv) redirect("/reservations");

  const balance = folioBalance(resv!.folio?.items ?? []);
  if (balance > 0.005) {
    redirect(`/reservations/${id}?error=balance`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.reservation.update({ where: { id }, data: { status: "CHECKED_OUT" } });
    if (resv!.roomId) {
      await tx.room.update({ where: { id: resv!.roomId }, data: { hkStatus: "DIRTY" } });
    }
  });

  await dispatchEvent(propertyId, "guest.checked_out", {
    summary: `${resv!.confirmation} checked out`,
    entity: "reservation",
    entityId: id,
    data: { confirmation: resv!.confirmation },
  });

  revalidatePath(`/reservations/${id}`);
  revalidatePath("/front-desk");
  revalidatePath("/rooms");
  revalidatePath("/");
}

// ─────────────────────────────────────────────────────────────
// Folio / billing
// ─────────────────────────────────────────────────────────────
export async function postCharge(formData: FormData) {
  const reservationId = s(formData.get("reservationId"));
  const description = s(formData.get("description")) || "Charge";
  const amount = parseFloat(s(formData.get("amount"))) || 0;
  const category = s(formData.get("category")) || "MISC";
  const propertyId = await requirePropertyId();
  if (amount <= 0) redirect(`/reservations/${reservationId}?error=amount`);
  const owned = await prisma.reservation.findFirst({ where: { id: reservationId, propertyId }, select: { id: true } });
  if (!owned) redirect("/reservations");

  const folio = await prisma.folio.upsert({
    where: { reservationId },
    create: { reservationId },
    update: {},
  });
  await prisma.folioItem.create({
    data: { folioId: folio.id, kind: "CHARGE", category, description, amount },
  });
  await dispatchEvent(propertyId, "folio.charge_posted", {
    summary: `Charge posted: ${description} (${amount})`,
    entity: "reservation",
    entityId: reservationId,
    data: { description, amount, category },
  });
  revalidatePath(`/reservations/${reservationId}`);
}

export async function postPayment(formData: FormData) {
  const reservationId = s(formData.get("reservationId"));
  const description = s(formData.get("description")) || "Payment";
  const amount = parseFloat(s(formData.get("amount"))) || 0;
  const propertyId = await requirePropertyId();
  if (amount <= 0) redirect(`/reservations/${reservationId}?error=amount`);
  const owned = await prisma.reservation.findFirst({ where: { id: reservationId, propertyId }, select: { id: true } });
  if (!owned) redirect("/reservations");

  const folio = await prisma.folio.upsert({
    where: { reservationId },
    create: { reservationId },
    update: {},
  });
  await prisma.folioItem.create({
    data: { folioId: folio.id, kind: "PAYMENT", category: "PAYMENT", description, amount },
  });
  await dispatchEvent(propertyId, "payment.recorded", {
    summary: `Payment recorded: ${description} (${amount})`,
    entity: "reservation",
    entityId: reservationId,
    data: { description, amount },
  });
  revalidatePath(`/reservations/${reservationId}`);
}

export async function deleteFolioItem(formData: FormData) {
  const itemId = s(formData.get("itemId"));
  const reservationId = s(formData.get("reservationId"));
  const propertyId = await requirePropertyId();
  // Only delete if the item's reservation belongs to this property.
  const item = await prisma.folioItem.findFirst({
    where: { id: itemId, folio: { reservation: { propertyId } } },
    select: { id: true },
  });
  if (item) await prisma.folioItem.delete({ where: { id: itemId } });
  revalidatePath(`/reservations/${reservationId}`);
}

// ─────────────────────────────────────────────────────────────
// Housekeeping / rooms
// ─────────────────────────────────────────────────────────────
export async function setRoomStatus(formData: FormData) {
  const roomId = s(formData.get("roomId"));
  const hkStatus = s(formData.get("hkStatus"));
  const propertyId = await requirePropertyId();
  const owned = await prisma.room.findFirst({ where: { id: roomId, propertyId }, select: { id: true } });
  if (!owned) redirect("/housekeeping");
  const room = await prisma.room.update({ where: { id: roomId }, data: { hkStatus } });
  await dispatchEvent(propertyId, "housekeeping.updated", {
    summary: `Room ${room.number} marked ${hkStatus.replace(/_/g, " ").toLowerCase()}`,
    entity: "room",
    entityId: roomId,
    data: { room: room.number, hkStatus },
  });
  revalidatePath("/housekeeping");
  revalidatePath("/rooms");
}

// ─────────────────────────────────────────────────────────────
// Guests
// ─────────────────────────────────────────────────────────────
export async function createGuest(formData: FormData) {
  const firstName = s(formData.get("firstName"));
  const lastName = s(formData.get("lastName"));
  const propertyId = await requirePropertyId();
  if (!firstName || !lastName) redirect("/guests?error=name");

  const guest = await prisma.guest.create({
    data: {
      propertyId,
      firstName,
      lastName,
      email: s(formData.get("email")) || null,
      phone: s(formData.get("phone")) || null,
      city: s(formData.get("city")) || null,
      country: s(formData.get("country")) || null,
      idNumber: s(formData.get("idNumber")) || null,
      vip: s(formData.get("vip")) === "on",
      notes: s(formData.get("notes")) || null,
    },
  });
  await dispatchEvent(propertyId, "guest.created", {
    summary: `New guest ${guest.firstName} ${guest.lastName}`,
    entity: "guest",
    entityId: guest.id,
    data: { name: `${guest.firstName} ${guest.lastName}`, email: guest.email },
  });
  revalidatePath("/guests");
  redirect(`/guests/${guest.id}`);
}

// ─────────────────────────────────────────────────────────────
// Inventory: room types & rate plans
// ─────────────────────────────────────────────────────────────
export async function createRoomType(formData: FormData) {
  const code = s(formData.get("code")).toUpperCase();
  const name = s(formData.get("name"));
  const propertyId = await requirePropertyId();
  if (!code || !name) redirect("/room-types?error=invalid");
  await prisma.roomType.create({
    data: {
      propertyId,
      code,
      name,
      description: s(formData.get("description")) || null,
      baseRate: parseFloat(s(formData.get("baseRate"))) || 0,
      maxOccupancy: parseInt(s(formData.get("maxOccupancy"))) || 2,
    },
  });
  revalidatePath("/room-types");
}

export async function createRatePlan(formData: FormData) {
  const code = s(formData.get("code")).toUpperCase();
  const name = s(formData.get("name"));
  const roomTypeId = s(formData.get("roomTypeId"));
  const propertyId = await requirePropertyId();
  if (!code || !name || !roomTypeId) redirect("/room-types?error=rateinvalid");
  // room type must belong to this property
  const typeOk = await prisma.roomType.findFirst({ where: { id: roomTypeId, propertyId }, select: { id: true } });
  if (!typeOk) redirect("/room-types?error=rateinvalid");
  await prisma.ratePlan.create({
    data: {
      propertyId,
      code,
      name,
      roomTypeId,
      rate: parseFloat(s(formData.get("rate"))) || 0,
      includesBreakfast: s(formData.get("includesBreakfast")) === "on",
    },
  });
  revalidatePath("/room-types");
}

export async function createRoom(formData: FormData) {
  const number = s(formData.get("number"));
  const roomTypeId = s(formData.get("roomTypeId"));
  const propertyId = await requirePropertyId();
  if (!number || !roomTypeId) redirect("/rooms?error=invalid");
  const typeOk = await prisma.roomType.findFirst({ where: { id: roomTypeId, propertyId }, select: { id: true } });
  if (!typeOk) redirect("/rooms?error=invalid");
  await prisma.room.create({
    data: {
      propertyId,
      number,
      roomTypeId,
      floor: parseInt(s(formData.get("floor"))) || 1,
      hkStatus: "CLEAN",
    },
  });
  revalidatePath("/rooms");
}

// ── Availability: rooms of a type free for the date range (scoped to property) ──
export async function availableRoomsFor(
  propertyId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string
) {
  const rooms = await prisma.room.findMany({
    where: { propertyId, roomTypeId, hkStatus: { not: "OUT_OF_ORDER" } },
    orderBy: { number: "asc" },
  });
  const overlapping = await prisma.reservation.findMany({
    where: {
      propertyId,
      roomId: { not: null },
      status: { in: ["BOOKED", "CHECKED_IN"] },
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
    },
    select: { roomId: true, checkIn: true, checkOut: true },
  });
  const busy = new Set(
    overlapping
      .filter((r) => rangesOverlap(checkIn, checkOut, r.checkIn, r.checkOut))
      .map((r) => r.roomId)
  );
  return rooms.filter((r) => !busy.has(r.id));
}
