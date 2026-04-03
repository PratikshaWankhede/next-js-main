"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

type CurrentLeadIdContextValue = {
  currentLeadId: string | null;
  setCurrentLeadId: (id: string | null) => void;
};

const CurrentLeadIdContext =
  createContext<CurrentLeadIdContextValue | null>(null);

export function CurrentLeadIdProvider({ children }: { children: ReactNode }) {
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);
  return (
    <CurrentLeadIdContext.Provider
      value={{ currentLeadId, setCurrentLeadId }}
    >
      {children}
    </CurrentLeadIdContext.Provider>
  );
}

export function useCurrentLeadId() {
  const ctx = useContext(CurrentLeadIdContext);
  return ctx?.currentLeadId ?? null;
}

export function useSetCurrentLeadId() {
  const ctx = useContext(CurrentLeadIdContext);
  return ctx?.setCurrentLeadId ?? (() => {});
}
