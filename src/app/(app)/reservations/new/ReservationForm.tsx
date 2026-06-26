"use client";

import { useState } from "react";
import { createReservation } from "@/lib/actions";
import { SOURCES } from "@/lib/domain";

type Guest = { id: string; firstName: string; lastName: string };
type RoomType = { id: string; name: string; baseRate: number; maxOccupancy: number };

export default function ReservationForm({
  guests,
  roomTypes,
  defaultCheckIn,
  defaultCheckOut,
}: {
  guests: Guest[];
  roomTypes: RoomType[];
  defaultCheckIn: string;
  defaultCheckOut: string;
}) {
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const selected = roomTypes.find((rt) => rt.id === roomTypeId);
  const [rate, setRate] = useState(roomTypes[0]?.baseRate ?? 0);

  return (
    <form action={createReservation} className="card max-w-2xl space-y-5 p-6">
      <div>
        <label className="label">Guest</label>
        <select name="guestId" required className="input" defaultValue={guests[0]?.id}>
          {guests.map((g) => (
            <option key={g.id} value={g.id}>
              {g.firstName} {g.lastName}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">
          New guest? Add them under Guests first.
        </p>
      </div>

      <div>
        <label className="label">Room type</label>
        <select
          name="roomTypeId"
          required
          className="input"
          value={roomTypeId}
          onChange={(e) => {
            setRoomTypeId(e.target.value);
            const rt = roomTypes.find((x) => x.id === e.target.value);
            if (rt) setRate(rt.baseRate);
          }}
        >
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name} — ${rt.baseRate}/night (max {rt.maxOccupancy})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Check-in</label>
          <input name="checkIn" type="date" required defaultValue={defaultCheckIn} className="input" />
        </div>
        <div>
          <label className="label">Check-out</label>
          <input name="checkOut" type="date" required defaultValue={defaultCheckOut} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Adults</label>
          <input name="adults" type="number" min={1} max={selected?.maxOccupancy ?? 4} defaultValue={1} className="input" />
        </div>
        <div>
          <label className="label">Children</label>
          <input name="children" type="number" min={0} defaultValue={0} className="input" />
        </div>
        <div>
          <label className="label">Rate / night</label>
          <input
            name="ratePerNight"
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Source</label>
          <select name="source" className="input" defaultValue="DIRECT">
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea name="notes" rows={2} className="input" placeholder="Special requests, arrival time…" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary">Create reservation</button>
        <a href="/reservations" className="btn-secondary">Cancel</a>
      </div>
    </form>
  );
}
