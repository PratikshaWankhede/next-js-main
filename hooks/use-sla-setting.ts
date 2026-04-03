import { useCallback, useEffect, useState } from "react";

const DEFAULT_SLA_MINUTES = 10;

export function useSlaSetting(): number {
  const [firstResponseSlaMinutes, setFirstResponseSlaMinutes] =
    useState<number>(DEFAULT_SLA_MINUTES);

  const fetchSla = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/sla");
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.firstResponseSlaMinutes === "number") {
        setFirstResponseSlaMinutes(data.firstResponseSlaMinutes);
      }
    } catch {
      // Keep default
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSla();
  }, [fetchSla]);

  return firstResponseSlaMinutes;
}
