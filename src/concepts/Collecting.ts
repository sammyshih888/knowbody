import { isIP } from "node:net";
import type { Collection, Db } from "mongodb";

export class InvalidCard extends Error {}
export class CardNotOwned extends Error {}
interface Card { _id: string; owner: string; label: string; urls: string[]; pageTypes?: string[]; archived: boolean }
const pageTypesAllowed = new Set(["Public webpage", "Personal site", "Professional profile", "Organization page", "Creative work"]);
const savedTypes = (row: Card) => row.pageTypes ?? row.urls.map(() => "Public webpage");

// Retrieval must also check resolved addresses and redirects before fetching.
// URL syntax alone cannot establish whether a destination is public or reachable.
function normalizeUrls(urls: string[]): string[] {
  if (!Array.isArray(urls) || urls.length < 1 || urls.length > 5) throw new Error();
  const normalized = urls.map(value => {
    if (typeof value !== "string" || value.length > 2048) throw new Error();
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !hostname.includes(".") || isIP(hostname) || hostname.startsWith("[") ||
        /\.(localhost|local|internal|test|invalid|example)$/.test(hostname)) throw new Error();
    url.hash = "";
    const reserved = ["example.com", "example.org", "example.net"];
    if (reserved.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) throw new Error();
    return url.href;
  });
  if (new Set(normalized).size !== normalized.length) throw new Error();
  return normalized;
}

export class CollectingConcept {
  private readonly cards: Collection<Card>;
  constructor(db: Db) { this.cards = db.collection<Card>("collecting.cards"); }

  async create({ owner, label, urls, pageTypes }: { owner: string; label: string; urls: string[]; pageTypes?: string[] }): Promise<{ card: string }> {
    let normalized: string[];
    try {
      if (typeof label !== "string" || !label.trim() || label.trim().length > 80) throw new Error();
      normalized = normalizeUrls(urls);
      if (pageTypes !== undefined && (!Array.isArray(pageTypes) || pageTypes.length !== normalized.length ||
          !pageTypes.every(type => pageTypesAllowed.has(type)))) throw new Error();
    } catch {
      throw new InvalidCard("Add a label and one to five distinct public HTTPS page URLs.");
    }
    const card = crypto.randomUUID();
    await this.cards.insertOne({ _id: card, owner, label: label.trim(), urls: normalized,
      pageTypes: pageTypes ?? normalized.map(() => "Public webpage"), archived: false });
    return { card };
  }

  async archive({ owner, card }: { owner: string; card: string }): Promise<{ card: string }> {
    const result = await this.cards.updateOne({ _id: card, owner }, { $set: { archived: true } });
    if (!result.matchedCount) throw new CardNotOwned("This card is not available to you.");
    return { card };
  }

  async _get({ card }: { card: string }): Promise<{ owner: string; label: string; urls: string[]; pageTypes: string[]; archived: boolean }[]> {
    const row = await this.cards.findOne({ _id: card });
    return row ? [{ owner: row.owner, label: row.label, urls: row.urls, pageTypes: savedTypes(row), archived: row.archived }] : [];
  }

  async _byOwner({ owner }: { owner: string }): Promise<{ card: string; label: string; urls: string[]; pageTypes: string[]; archived: boolean }[]> {
    const rows = await this.cards.find({ owner }).sort({ label: 1, _id: 1 }).toArray();
    return rows.map(row => ({ card: row._id, label: row.label, urls: row.urls, pageTypes: savedTypes(row), archived: row.archived }));
  }

  async _offerPreview({ owner, card }: { owner: string; card: string }): Promise<{ preview: string }[]> {
    const row = await this.cards.findOne({ _id: card, owner, archived: false });
    return row ? [{ preview: savedTypes(row).join(", ") }] : [];
  }
}
