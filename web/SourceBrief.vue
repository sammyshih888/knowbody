<script setup lang="ts">
import type { ReportDetails } from "../src/concepts/Researching.ts";
defineProps<{ details: ReportDetails | null; heading: string }>();
const date = (value: string) => new Date(value).toLocaleString();
</script>
<template>
  <section class="source-brief">
    <div class="panel-heading"><h3>{{ heading }}</h3><span class="badge">{{ details?.status === 'READY' ? 'Ready' : details?.status === 'FAILED' ? 'Unavailable' : details?.status === 'CANCELLED' ? 'Cancelled' : 'Preparing' }}</span></div>
    <p v-if="!details || details.status === 'PENDING'" class="muted" role="status">Preparing a brief from the selected pages. This updates automatically.</p>
    <p v-else-if="details.status === 'CANCELLED'" class="muted">The exchange ended before this brief was completed.</p>
    <p v-else-if="details.status === 'FAILED'" class="muted">This brief could not be prepared. You can still open the selected sources. Start a new exchange to try again.</p>
    <template v-else>
      <p class="muted">Excerpts from the selected pages, with their sources. They do not verify identity or trustworthiness.</p>
      <article v-for="(source, index) in details.sources" :key="source.url" class="source-entry">
        <h4><span class="source-number">{{ index + 1 }}</span>{{ source.title ?? 'Selected page' }}</h4>
        <a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.url }} ↗</a>
        <template v-if="source.outcome === 'READABLE'">
          <blockquote>{{ source.excerpt }}</blockquote>
          <small v-if="source.finalUrl && source.finalUrl !== source.url">Redirected on the same website to <a :href="source.finalUrl" target="_blank" rel="noopener noreferrer">{{ source.finalUrl }}</a></small>
          <small>Retrieved {{ date(source.retrievedAt) }} · {{ source.pageDate ? `Page date supplied by source: ${source.pageDate}` : 'Page date not supplied' }}</small>
        </template>
        <p v-else class="unchecked"><strong>Content not checked</strong><br />This page could not be read as public HTML. This says nothing about the person.<small>Attempted {{ date(source.retrievedAt) }}</small></p>
      </article>
      <div class="source-links"><h4>Links between these pages</h4>
        <p v-if="!details.findings.length" class="muted">No direct links were found between the readable selected pages. No other pages were checked.</p>
        <ol v-else><li v-for="(finding, index) in details.findings" :key="index"><p>{{ finding.explanation }}</p><a :href="finding.sourceURLs[0]" target="_blank" rel="noopener noreferrer">From: {{ finding.sourceURLs[0] }}</a><a :href="finding.sourceURLs[1]" target="_blank" rel="noopener noreferrer">To: {{ finding.sourceURLs[1] }}</a></li></ol>
      </div>
    </template>
  </section>
</template>
