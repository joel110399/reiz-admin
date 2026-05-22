import { apiJson } from "./api-client";
import type { Paginated } from "@/types/drf";

/** Sigue `next` hasta agotar (cuidado con colecciones muy grandes). */
export async function fetchAllPages<T>(firstPath: string): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = firstPath;
  let guard = 0;
  const maxPages = 50;
  while (url && guard < maxPages) {
    const page: Paginated<T> = await apiJson<Paginated<T>>(url);
    items.push(...page.results);
    url = page.next;
    guard += 1;
  }
  return items;
}
