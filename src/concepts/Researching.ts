import type { Collection, Db } from "mongodb";

export class InvalidResearch extends Error {}
export class InvalidResearchResult extends Error {}
export type ReportStatus = "PENDING" | "READY" | "FAILED" | "CANCELLED";
export interface SourceData {
  url: string; outcome: "READABLE" | "UNAVAILABLE"; title: string | null;
  excerpt: string; retrievedAt: string; pageDate: string | null; finalUrl: string | null;
  linksTo: string[];
  passages?: string[];
}
export interface FindingData {
  kind: "LINK" | "SAME_TEXT" | "PASSAGES"; sourceURLs: string[]; explanation: string;
  quotes?: string[];
}
export const normalizedText = (text: string) => text.replace(/\s+/g, " ").trim();
export interface ReportDetails {
  owner: string; context: string; urls: string[]; status: ReportStatus;
  sources: SourceData[]; findings: FindingData[];
}
interface Report extends ReportDetails { report: string }
interface Context { _id: string; cancelled: boolean; reports: Report[] }

export class ResearchingConcept {
  private readonly contexts: Collection<Context>;
  constructor(db: Db) { this.contexts = db.collection<Context>("researching.contexts"); }

  async start({ owner, context, urls }: { owner: string; context: string; urls: string[] }): Promise<{ report: string }> {
    if (!Array.isArray(urls) || urls.length < 1 || urls.length > 5 || new Set(urls).size !== urls.length ||
        urls.some(url => { try { return new URL(url).protocol !== "https:"; } catch { return true; } }))
      throw new InvalidResearch("Research requires a fixed selection of one to five HTTPS URLs in an open context.");
    await this.contexts.updateOne({ _id: context }, { $setOnInsert: { cancelled: false, reports: [] } }, { upsert: true });
    const report = `report:${crypto.randomUUID()}`;
    const result = await this.contexts.updateOne({ _id: context, cancelled: false, "reports.owner": { $ne: owner } },
      { $push: { reports: { report, owner, context, urls: [...urls], status: "PENDING", sources: [], findings: [] } } });
    if (result.modifiedCount) return { report };
    const existing = (await this.contexts.findOne({ _id: context, cancelled: false }))?.reports.find(row => row.owner === owner);
    if (existing && JSON.stringify(existing.urls) === JSON.stringify(urls)) return { report: existing.report };
    throw new InvalidResearch("Research requires a fixed selection of one to five HTTPS URLs in an open context.");
  }

  async finish({ report, sourceData, findingData }: { report: string; sourceData: SourceData[]; findingData: FindingData[] }): Promise<{ stored: boolean }> {
    const row = (await this._get({ report }))[0]?.details;
    if (!row || row.status !== "PENDING") return { stored: false };
    const invalid = () => { throw new InvalidResearchResult("Results must describe exactly the saved sources and supported comparisons between them."); };
    if (!Array.isArray(sourceData) || sourceData.length !== row.urls.length ||
        sourceData.some(source => !source || typeof source !== "object") ||
        new Set(sourceData.map(source => source.url)).size !== row.urls.length) invalid();
    for (const source of sourceData) {
      if (!row.urls.includes(source.url) || !["READABLE", "UNAVAILABLE"].includes(source.outcome) ||
          typeof source.excerpt !== "string" || source.excerpt.length > 1000 ||
          !Number.isFinite(Date.parse(source.retrievedAt)) ||
          !(source.title === null || typeof source.title === "string" && source.title.length <= 200) ||
          !(source.pageDate === null || typeof source.pageDate === "string" && source.pageDate.length <= 80) ||
          !Array.isArray(source.linksTo) || source.linksTo.some(url => !row.urls.includes(url) || url === source.url)) invalid();
      if (source.passages !== undefined && (!Array.isArray(source.passages) || source.passages.length > 20 ||
          source.passages.some(text => typeof text !== "string" || !text.trim() || text.length > 1000))) invalid();
      if (source.outcome === "UNAVAILABLE" && (source.excerpt !== "" || source.linksTo.length !== 0)) invalid();
      if (source.outcome === "UNAVAILABLE" && source.passages?.length) invalid();
      if (source.outcome === "READABLE" && !source.excerpt.trim()) invalid();
      if (source.finalUrl !== null) {
        try {
          const final = new URL(source.finalUrl), original = new URL(source.url);
          if (final.protocol !== "https:" || final.hostname !== original.hostname || final.port || final.username || final.password) invalid();
        } catch { invalid(); }
      }
    }
    if (!Array.isArray(findingData) || findingData.length > 60) invalid();
    for (const finding of findingData) {
      if (!finding || !["LINK", "SAME_TEXT", "PASSAGES"].includes(finding.kind) || !Array.isArray(finding.sourceURLs) || finding.sourceURLs.length !== 2 ||
          new Set(finding.sourceURLs).size !== 2 || typeof finding.explanation !== "string" || finding.explanation.length > 300) invalid();
      const evidence = finding.sourceURLs.map(url => sourceData.find(source => source.url === url && source.outcome === "READABLE"));
      if (evidence.some(source => !source)) invalid();
      if (evidence[0]!.finalUrl && evidence[0]!.finalUrl === evidence[1]!.finalUrl) invalid();
      if (finding.kind === "LINK") {
        if (!evidence[0]?.linksTo.includes(finding.sourceURLs[1]!) || finding.quotes !== undefined) invalid();
      } else {
        if (!Array.isArray(finding.quotes) || finding.quotes.length !== 2 || finding.quotes.some((quote, index) =>
          typeof quote !== "string" || quote.length < 40 || quote.length > 1000 ||
          !(evidence[index]?.passages ?? [evidence[index]!.excerpt]).includes(quote))) invalid();
        if (finding.kind === "SAME_TEXT" && normalizedText(finding.quotes![0]!) !== normalizedText(finding.quotes![1]!)) invalid();
      }
    }
    const result = await this.contexts.updateOne({ cancelled: false, reports: { $elemMatch: { report, status: "PENDING" } } },
      { $set: { "reports.$.status": "READY", "reports.$.sources": sourceData, "reports.$.findings": findingData } });
    return { stored: !!result.modifiedCount };
  }

  async fail({ report }: { report: string }): Promise<{ stored: boolean }> {
    const result = await this.contexts.updateOne({ cancelled: false, reports: { $elemMatch: { report, status: "PENDING" } } }, { $set: { "reports.$.status": "FAILED" } });
    return { stored: !!result.modifiedCount };
  }

  async cancel({ report }: { report: string }): Promise<Record<string, never>> {
    await this.contexts.updateOne({ reports: { $elemMatch: { report, status: "PENDING" } } }, { $set: { "reports.$.status": "CANCELLED" } });
    return {};
  }

  async cancelContext({ context }: { context: string }): Promise<Record<string, never>> {
    await this.contexts.updateOne({ _id: context }, [
      { $set: { cancelled: true, reports: { $map: { input: { $ifNull: ["$reports", []] }, as: "report",
        in: { $cond: [{ $eq: ["$$report.status", "PENDING"] }, { $mergeObjects: ["$$report", { status: "CANCELLED" }] }, "$$report"] } } } } },
    ], { upsert: true });
    return {};
  }

  async _get({ report }: { report: string }): Promise<{ details: ReportDetails }[]> {
    const row = (await this.contexts.findOne({ "reports.report": report }))?.reports.find(row => row.report === report);
    if (!row) return [];
    const { report: _, ...details } = row;
    return [{ details }];
  }

  async _forOwner({ owner, context }: { owner: string; context: string }): Promise<{ report: string }[]> {
    const row = (await this.contexts.findOne({ _id: context }))?.reports.find(row => row.owner === owner);
    return row ? [{ report: row.report }] : [];
  }

  async _pending(): Promise<{ report: string; context: string; urls: string[] }[]> {
    return (await this.contexts.find({ cancelled: false, "reports.status": "PENDING" }).sort({ _id: 1 }).toArray())
      .flatMap(row => row.reports.filter(report => report.status === "PENDING").map(report => ({ report: report.report, context: row._id, urls: report.urls })));
  }

  async _pendingReport({ report }: { report: string }): Promise<{ context: string }[]> {
    const row = await this.contexts.findOne({ cancelled: false, reports: { $elemMatch: { report, status: "PENDING" } } });
    return row ? [{ context: row._id }] : [];
  }

  async _cancelled({ context }: { context: string }): Promise<{ cancelled: boolean }> {
    return { cancelled: !!(await this.contexts.findOne({ _id: context, cancelled: true })) };
  }
}
