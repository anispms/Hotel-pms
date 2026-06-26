"use client";

import { useRef } from "react";
import { switchProperty } from "@/lib/admin-actions";

type Prop = { id: string; name: string };

export default function PropertySwitcher({
  properties,
  currentId,
}: {
  properties: Prop[];
  currentId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (properties.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5">
        <span className="text-base">🏨</span>
        <span className="text-sm font-medium text-gray-700">{properties[0]?.name ?? "—"}</span>
      </div>
    );
  }

  return (
    <form action={switchProperty} ref={formRef} className="flex items-center gap-2">
      <span className="text-base">🏨</span>
      <select
        name="propertyId"
        defaultValue={currentId}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-medium text-gray-700 outline-none focus:border-brand-500"
      >
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </form>
  );
}
