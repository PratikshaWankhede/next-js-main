import type { Collection, Document, Filter } from "mongodb";
import { db } from "@/db";

export async function findOneById<T extends Document & { id: string }>(
  collectionName: string,
  id: string,
): Promise<T | null> {
  const col = db.collection<T>(collectionName);
  const filter: Filter<T> = { id } as Filter<T>;
  return col.findOne(filter) as Promise<T | null>;
}

export function getCollection<T extends Document>(
  collectionName: string,
): Collection<T> {
  return db.collection<T>(collectionName);
}
