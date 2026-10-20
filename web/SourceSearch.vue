<script setup lang="ts">
import { ref } from "vue";
import type { SearchResult } from "../src/discovery.ts";
const props = defineProps<{ selected: string[] }>();
const emit = defineEmits<{ select: [url: string]; expired: [] }>();
const query = ref("");
const results = ref<SearchResult[]>([]);
const busy = ref(false);
const searched = ref(false);
const error = ref("");
const selected = (url: string) => props.selected.some(value => {
  try { const parsed = new URL(value); parsed.hash = ""; return parsed.href === url; } catch { return false; }
});
async function search() {
  busy.value = true;
  error.value = "";
  searched.value = false;
  results.value = [];
  try {
    const response = await fetch("/api/search", { method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: query.value.trim() }) });
    const data = await response.json();
    if (response.status === 401) { emit("expired"); return; }
    if (!response.ok) {
      error.value = data.error === "SEARCH_LIMIT"
        ? "Search is temporarily limited. Wait a few seconds before trying again. If the free monthly allowance is used up, you can still paste your links below."
        : "Search is unavailable right now. You can still paste your public page links below.";
      return;
    }
    results.value = data.results;
    searched.value = true;
  } catch { error.value = "Couldn't load search results. Try again or paste your links below."; }
  finally { busy.value = false; }
}
</script>

<template>
  <section class="discovery" aria-labelledby="discovery-heading">
    <h3 id="discovery-heading">Find your public pages</h3>
    <p class="muted">Search for your name with a school, workplace, or project. Check that each page is about you before adding it.</p>
    <form @submit.prevent="search">
      <label for="source-query">Search your public pages</label>
      <input id="source-query" v-model="query" required maxlength="160" placeholder="Your name + school or project" aria-describedby="search-privacy" />
      <small id="search-privacy">Search terms go to Tavily. Results stay out of your card until you select them.</small>
      <button class="primary" :disabled="busy || !query.trim()">{{ busy ? 'Searching…' : 'Search' }}</button>
    </form>
    <p v-if="busy" role="status" class="muted">Looking for candidate pages…</p>
    <p v-if="error" role="alert" class="message error">{{ error }}</p>
    <p v-if="searched && !results.length" role="status" class="muted">No selectable public HTTPS pages found. Try another query or paste a link below.</p>
    <p v-else-if="searched" role="status" class="muted">{{ results.length }} suggestions. A matching name does not establish that a page is yours.</p>
    <ul class="search-results">
      <li v-for="result in results" :key="result.url">
        <a :href="result.url" target="_blank" rel="noopener noreferrer">{{ result.title }} ↗</a>
        <small>{{ result.url }}</small><p>{{ result.snippet }}</p>
        <button class="text-button" :disabled="selected(result.url) || props.selected.length >= 5" @click="emit('select', result.url)">{{ selected(result.url) ? 'Added to selection' : 'Add to selection' }}</button>
      </li>
    </ul>
    <p v-if="props.selected.length >= 5" class="muted">Your selection has five links. Remove a link below to choose another.</p>
  </section>
</template>
