<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, type Card } from "./api.ts";
import SourceSearch from "./SourceSearch.vue";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ cards: Card[]; reloadCards: () => Promise<void> }>();
const emit = defineEmits<{ expired: [] }>();
const route = useRoute();
const router = useRouter();
const creating = computed(() => route.name === "new-card");
const returnExchange = computed(() => typeof route.query.exchange === "string" ? route.query.exchange : "");
const busy = ref(false);
const error = ref("");
const notice = ref("");
const errorBox = ref<HTMLElement | null>(null);
watch(error, async message => {
  if (message) { await nextTick(); errorBox.value?.focus(); }
});
const label = ref("");
const links = ref("");
const pageTypes = ref<Record<string, string>>({});
const categoryOptions = ["Public webpage", "Personal site", "Professional profile", "Organization page", "Creative work"];
const archiveTarget = ref<string | null>(null);
const archiving = ref(false);
const showArchived = ref(false);
const visibleCards = computed(() => props.cards.filter(card => showArchived.value || !card.archived));
const urls = computed(() => links.value.split(/\r?\n/).map(url => url.trim()).filter(Boolean));

function showError(code: string) {
  if (code === "UNAUTHORIZED") { emit("expired"); return; }
  const messages: Record<string, string> = {
    INVALID_REQUEST: "Add a label and 1–5 different public HTTPS links. Local addresses and example domains cannot be saved.",
    FORBIDDEN: "You don't have permission to change this card.",
    NOT_FOUND: "This card is not available to you.",
  };
  error.value = messages[code] ?? "Couldn't save your changes. Please try again.";
}

async function saveCard() {
  error.value = "";
  notice.value = "";
  if (urls.value.length < 1 || urls.value.length > 5) {
    error.value = "Choose between one and five links, with one link on each line.";
    return;
  }
  busy.value = true;
  try {
    const result = await api.cards.create({ label: label.value, urls: urls.value,
      pageTypes: urls.value.map(url => pageTypes.value[url] ?? "Public webpage") });
    if ("error" in result) { showError(result.error); return; }
    label.value = "";
    links.value = "";
    pageTypes.value = {};
    notice.value = "Card saved. Only you can see these links.";
    await props.reloadCards();
    await router.push(returnExchange.value ? `/exchanges/${encodeURIComponent(returnExchange.value)}` : "/cards");
  } catch { error.value = "Couldn't save your card. Please try again."; }
  finally { busy.value = false; }
}

function addSearchURL(url: string) {
  if (urls.value.length >= 5 || urls.value.includes(url)) return;
  links.value = [...urls.value, url].join("\n");
}

async function removeURL(url: string) {
  const index = urls.value.indexOf(url);
  links.value = urls.value.filter(value => value !== url).join("\n");
  delete pageTypes.value[url];
  await nextTick();
  const next = document.getElementById(`type-${Math.min(index, urls.value.length - 1)}`);
  (next ?? document.getElementById("card-urls"))?.focus();
}

async function archiveCard(card: string) {
  error.value = "";
  notice.value = "";
  archiving.value = true;
  try {
    const result = await api.cards.archive({ card });
    if ("error" in result) { showError(result.error); return; }
    archiveTarget.value = null;
    notice.value = "Card archived. Replace it in any exchange still awaiting approval. Already-shared exchanges keep access until someone ends them.";
    await props.reloadCards();
  } catch { error.value = "Couldn't archive your card. Please try again."; }
  finally { archiving.value = false; }
}

</script>

<template>
  <section aria-labelledby="cards-heading">
    <RouterLink v-if="creating" class="back-link" :to="returnExchange ? `/exchanges/${encodeURIComponent(returnExchange)}` : '/cards'">← {{ returnExchange ? 'Back to exchange' : 'Your cards' }}</RouterLink>
    <p class="eyebrow">CHOOSE WHAT TO SHARE</p>
    <div class="page-heading"><div><h1 id="cards-heading">{{ creating ? 'Create a card' : 'Your cards' }}</h1>
    <p class="lead">{{ creating ? 'Save 1–5 links to public pages about you. Your card stays private in Knowbody until both people approve an exchange.' : 'Group links to your public profiles, personal site, or work into cards. Exchange a card with someone before meeting; both of you must approve before the links are shared.' }}</p></div>
    <RouterLink v-if="!creating" class="primary button-link" to="/cards/new">New card</RouterLink></div>
    <div v-if="error" ref="errorBox" class="message error" role="alert" tabindex="-1">{{ error }}</div>
    <div v-if="notice" class="message success" role="status">{{ notice }}</div>
          <div class="workspace">
            <section v-show="creating" class="panel" aria-labelledby="new-card-heading">
              <div class="panel-heading"><h2 id="new-card-heading">Add your public pages</h2><span class="count">{{ urls.length }} / 5</span></div>
              <div class="source-picker">
              <SourceSearch :selected="urls" @select="addSearchURL" @expired="showError('UNAUTHORIZED')" />
              <form @submit.prevent="saveCard">
                <h3>Pages in this card</h3>
                <label for="card-label">Card name</label>
                <input id="card-label" v-model="label" required maxlength="80" placeholder="Portfolio + club bio" />
                <label for="card-urls">Public page links</label>
                <textarea id="card-urls" v-model="links" rows="3" required placeholder="https://your-website.com/about&#10;https://your-club.org/people/you" aria-describedby="links-hint"></textarea>
                <small id="links-hint">One HTTPS link per line, up to five. Choose pages about you that you're comfortable sharing. Sites such as LinkedIn may only work as links if Knowbody cannot read their content.</small>
                <fieldset v-if="urls.length > 0 && urls.length <= 5" class="page-types"><legend>Choose each page type</legend><p class="muted">Only these categories appear to the other person before approval.</p><div v-for="(url, i) in urls" :key="`${i}-${url}`" class="selected-page"><div class="selection-heading"><label :for="`type-${i}`">{{ url }}</label><button type="button" class="text-button" :aria-label="`Remove ${url}`" @click="removeURL(url)">Remove</button></div><select :id="`type-${i}`" :value="pageTypes[url] ?? 'Public webpage'" @change="pageTypes[url] = ($event.target as HTMLSelectElement).value"><option v-for="category in categoryOptions" :key="category">{{ category }}</option></select></div></fieldset>
                <p v-if="urls.length" class="selection-status" role="status">{{ urls.length }} {{ urls.length === 1 ? 'page' : 'pages' }} selected. Nothing is shared yet.</p>
                <p class="save-note">Saved selections stay fixed. To choose different links, make another card.</p>
                <button class="primary full" :disabled="busy">{{ busy ? 'Saving…' : 'Save private card' }}</button>
              </form>
              </div>
            </section>
            <section v-if="!creating" class="saved" aria-labelledby="saved-heading">
              <div class="panel-heading"><h2 id="saved-heading">Saved cards</h2><span class="muted">{{ visibleCards.length }}</span></div>
              <button v-if="cards.some(card => card.archived)" class="text-button" :aria-pressed="showArchived" @click="showArchived = !showArchived">{{ showArchived ? 'Hide archived cards' : 'Show archived cards' }}</button>
              <div v-if="!cards.length" class="empty-state"><span class="empty-mark" aria-hidden="true">▤</span><h3>No cards yet.</h3><p>Create a card with the public pages you want to share.</p><RouterLink class="primary button-link" to="/cards/new">Create your first card</RouterLink></div>
              <p v-if="cards.length && !visibleCards.length" class="muted">All your cards are archived. Create a new card to start another exchange.</p>
              <article v-for="card in visibleCards" :key="card.card" class="saved-card">
                <div class="panel-heading"><h3>{{ card.label }}</h3><span class="badge">{{ card.archived ? 'Archived' : 'Saved' }}</span></div>
                <ul><li v-for="url in card.urls" :key="url"><a :href="url" target="_blank" rel="noopener noreferrer">{{ url }} <span aria-hidden="true">↗</span></a></li></ul>
                <p class="card-footer">{{ card.pageTypes.join(' · ') }} · Sharing managed per exchange</p>
                <template v-if="!card.archived">
                  <div v-if="archiveTarget === card.card" class="card-confirmation">
                    <p>Archive this card? It cannot be offered in new exchanges. Any exchange still awaiting approval needs a replacement card. Already-shared exchanges keep access until someone ends them. To reuse these links, save a new card.</p>
                    <button class="primary" :disabled="archiving" @click="archiveCard(card.card)">{{ archiving ? 'Archiving…' : 'Archive card' }}</button>
                    <button class="text-button" :disabled="archiving" @click="archiveTarget = null">Keep card</button>
                  </div>
                  <button v-else class="text-button" :disabled="archiving" @click="archiveTarget = card.card">Archive</button>
                </template>
              </article>
            </section>
          </div>
  </section>
</template>
