<script setup lang="ts">
import type { ReportDetails } from "../src/concepts/Researching.ts";
defineProps<{ details: ReportDetails | null; heading: string }>();
const date = (value: string) => new Date(value).toLocaleString();
const findingTitle = { LINK: "Direct link", SAME_TEXT: "Matching wording", PASSAGES: "Passages to compare" };
const repeatedPage = (details: ReportDetails) => {
  const destinations = details.sources.filter(source => source.outcome === "READABLE").map(source => source.finalUrl ?? source.url);
  return new Set(destinations).size < destinations.length;
};
</script>
<template>
  <section class="source-brief">
    <div class="panel-heading"><h3>{{ heading }}</h3><span class="badge" :class="{ 'badge-neutral': details?.status !== 'READY' }">{{ details?.status === 'READY' ? 'Ready' : details?.status === 'FAILED' ? 'Unavailable' : details?.status === 'CANCELLED' ? 'Cancelled' : 'Preparing' }}</span></div>
    <p v-if="!details || details.status === 'PENDING'" class="muted" role="status">Preparing a brief from the selected pages. This updates automatically.</p>
    <p v-else-if="details.status === 'CANCELLED'" class="muted">The exchange ended before this brief was completed.</p>
    <p v-else-if="details.status === 'FAILED'" class="muted">This brief could not be prepared. You can still open the selected sources. Start a new exchange to try again.</p>
    <template v-else>
      <p class="muted">Excerpts and comparisons from this card's public pages. This brief does not verify identity or trustworthiness.</p>
      <p v-if="repeatedPage(details)" class="muted">Some selected links lead to the same page. They are not separate sources of evidence.</p>
      <div class="brief-layout">
      <section class="source-links"><h4>Comparisons between selected pages</h4>
        <p class="muted">Only the selected pages were checked. Comparisons use limited excerpts, so missing matches do not mean the pages disagree. Page dates may be missing or outdated.</p>
        <p v-if="!details.findings.length" class="muted">No supported comparison was found in the readable excerpts. You can open the sources to compare further.</p>
        <article v-for="(finding, index) in details.findings" :key="index" class="comparison">
          <h4>{{ findingTitle[finding.kind] }}</h4><p>{{ finding.explanation }}</p>
          <div :class="{ 'comparison-passages': finding.quotes }">
            <div v-for="(url, sourceIndex) in finding.sourceURLs" :key="url">
              <blockquote v-if="finding.quotes">{{ finding.quotes[sourceIndex] }}</blockquote>
              <p class="comparison-source">{{ details.sources.find(source => source.url === url)?.title ?? 'Selected page' }}</p>
              <a :href="url" target="_blank" rel="noopener noreferrer">{{ finding.kind === 'LINK' ? (sourceIndex === 0 ? 'From: ' : 'To: ') : '' }}{{ url }}</a>
              <small v-if="finding.quotes">{{ details.sources.find(source => source.url === url)?.pageDate ?? 'Page date not detected' }}</small>
            </div>
          </div>
        </article>
      </section>
        <aside class="brief-sources" aria-label="Selected sources"><h4>Selected sources</h4>
          <article v-for="(source, index) in details.sources" :key="source.url" class="source-entry">
        <h4><span class="source-number">{{ index + 1 }}</span>{{ source.title ?? 'Selected page' }}</h4>
        <a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.url }} ↗</a>
        <template v-if="source.outcome === 'READABLE'">
          <details class="source-excerpt"><summary>Read excerpt</summary><blockquote>{{ source.excerpt }}</blockquote></details>
          <small v-if="source.finalUrl && source.finalUrl !== source.url">Redirected on the same website to <a :href="source.finalUrl" target="_blank" rel="noopener noreferrer">{{ source.finalUrl }}</a></small>
          <small>Retrieved {{ date(source.retrievedAt) }} · {{ source.pageDate ? `Page date supplied by source: ${source.pageDate}` : 'Page date not detected' }}</small>
        </template>
        <p v-else class="unchecked"><strong>Content not checked</strong><br />Knowbody couldn't read this page. It may require sign-in, block automated access, or be temporarily unavailable. Open the source link to view it yourself. This page wasn't used in comparisons.<small>Attempted {{ date(source.retrievedAt) }}</small></p>
      </article>
        </aside>
      </div>
    </template>
  </section>
</template>
