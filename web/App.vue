<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { api, type Card } from "./api.ts";
import Exchanges from "./Exchanges.vue";
import SourceSearch from "./SourceSearch.vue";

const account = ref<{ user: string; username: string } | null>(null);
const cards = ref<Card[]>([]);
const loading = ref(true);
const busy = ref(false);
const mode = ref<"register" | "sign-in">("register");
const username = ref("");
const password = ref("");
const label = ref("");
const links = ref("");
const pageTypes = ref<Record<string, string>>({});
const categoryOptions = ["Public webpage", "Personal site", "Professional profile", "Organization page", "Creative work"];
const hasInvitation = ref(!!new URLSearchParams(window.location.hash.slice(1)).get("invite"));
const updateInvitation = () => { hasInvitation.value = !!new URLSearchParams(window.location.hash.slice(1)).get("invite"); };
const error = ref("");
const errorBox = ref<HTMLElement | null>(null);
watch(error, async message => {
  if (message) { await nextTick(); errorBox.value?.focus(); }
});
const notice = ref("");
const archiveTarget = ref<string | null>(null);
const archiving = ref(false);
const showArchived = ref(false);
const visibleCards = computed(() => cards.value.filter(card => showArchived.value || !card.archived));
const urls = computed(() => links.value.split(/\r?\n/).map(url => url.trim()).filter(Boolean));

function goToSection(id: string) {
  const section = document.getElementById(id);
  section?.focus({ preventScroll: true });
  section?.scrollIntoView({ block: "start" });
}

function showError(code: string, context: "account" | "card" | "sign-in" = "account") {
  const messages: Record<string, string> = {
    CONFLICT: "That username is already taken. Try another or sign in.",
    INVALID_REQUEST: context === "card"
      ? "Add a label and 1–5 different public HTTPS links. Local addresses and example domains cannot be saved."
      : "Use 1–32 letters, numbers, underscores, or hyphens for your username and a nonempty password (up to 128 characters).",
    UNAUTHORIZED: context === "sign-in" ? "The username or password is incorrect." : "Your session has ended. Please sign in again.",
    FORBIDDEN: context === "card" ? "You don't have permission to change this card." : "This request wasn't accepted. Reload the app and try again.",
    NOT_FOUND: "This card is not available to you.",
  };
  error.value = messages[code] ?? "Couldn't connect to Knowbody. Please try again.";
  if (code === "UNAUTHORIZED" && context !== "sign-in") {
    account.value = null;
    cards.value = [];
    mode.value = "sign-in";
  }
}

async function loadCards() {
  const result = await api.cards.list({});
  if ("error" in result) { showError(result.error, "card"); return; }
  cards.value = result.collection.cards;
}

async function submitAccount() {
  error.value = "";
  notice.value = "";
  busy.value = true;
  try {
    const credentials = { username: username.value.trim(), password: password.value };
    if (mode.value === "register") {
      const result = await api.auth.register(credentials);
      if ("error" in result) { showError(result.error); return; }
      mode.value = "sign-in";
      notice.value = "Account created. Sign in to start your first card.";
      password.value = "";
    } else {
      const result = await api.auth["sign-in"](credentials);
      if ("error" in result) { showError(result.error, "sign-in"); return; }
      account.value = { user: result.user, username: credentials.username };
      password.value = "";
      await loadCards();
    }
  } catch { error.value = "Couldn't connect to Knowbody. Please try again."; }
  finally { busy.value = false; }
}

async function signOut() {
  busy.value = true;
  error.value = "";
  try {
    const result = await api.auth["sign-out"]({});
    if ("error" in result) { showError(result.error); return; }
    account.value = null;
    cards.value = [];
    links.value = "";
    archiveTarget.value = null;
    showArchived.value = false;
    pageTypes.value = {};
    label.value = "";
    notice.value = "";
    mode.value = "sign-in";
    updateInvitation();
  } catch { error.value = "Couldn't sign out. Please try again."; }
  finally { busy.value = false; }
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
    if ("error" in result) { showError(result.error, "card"); return; }
    label.value = "";
    links.value = "";
    pageTypes.value = {};
    notice.value = "Card saved. Only you can see these links.";
    await loadCards();
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
    if ("error" in result) { showError(result.error, "card"); return; }
    archiveTarget.value = null;
    notice.value = "Card archived. Existing active exchanges still have access until you end them.";
    await loadCards();
  } catch { error.value = "Couldn't archive your card. Please try again."; }
  finally { archiving.value = false; }
}

onMounted(async () => {
  window.addEventListener("hashchange", updateInvitation);
  try {
    const current = await api.auth.current({});
    if (!("error" in current)) { account.value = current; await loadCards(); }
    else if (current.error !== "UNAUTHORIZED") showError(current.error);
  } catch { error.value = "Couldn't connect to Knowbody. Please try again."; }
  finally { loading.value = false; }
});
onUnmounted(() => window.removeEventListener("hashchange", updateInvitation));
</script>

<template>
  <svg v-for="corner in ['top', 'bottom']" :key="corner" class="leaf-accent" :class="`leaf-${corner}`" viewBox="0 0 210 330" aria-hidden="true" focusable="false">
    <path d="M20 330C50 255 90 178 128 58" fill="none" stroke="currentColor" stroke-width="5" />
    <path d="M106 128C93 65 129 19 181 0C170 64 149 107 106 128Z" />
    <path d="M75 207C63 154 25 128 0 116C-2 164 21 197 75 207Z" />
    <path d="M63 232C100 176 154 165 197 175C165 218 120 239 63 232Z" />
  </svg>
  <div class="shell">
    <a class="skip-link" href="#main-content" @click.prevent="goToSection('main-content')">Skip to content</a>
    <header class="topbar">
      <a href="/" class="brand" aria-label="Knowbody home">knowbody</a>
      <nav v-if="account" class="section-nav" aria-label="Your workspace"><a href="#your-profiles" @click.prevent="goToSection('your-profiles')">Your profiles</a><a href="#your-exchanges" @click.prevent="goToSection('your-exchanges')">Exchanges</a></nav>
      <div v-if="account" class="account"><span>{{ account.username }}</span><button class="text-button" :disabled="busy" @click="signOut">Sign out</button></div>
      <span v-else class="header-note">A little context. On your terms.</span>
    </header>

    <main id="main-content" tabindex="-1">
      <p v-if="loading" class="loading" role="status">Opening Knowbody…</p>
      <template v-else>
        <div v-if="error" ref="errorBox" class="message error" role="alert" tabindex="-1">{{ error }}</div>
        <div v-if="notice" class="message success" role="status">{{ notice }}</div>

        <div v-if="!account" class="welcome">
          <section class="intro">
            <p class="eyebrow">YOUR PAGES, YOUR CHOICE</p>
            <h1>A little more context.<br />A choice in what you share.</h1>
            <p>Start with the public pages that tell your story. Save them together in a private card, ready for an introduction.</p>
            <div class="privacy-note"><p>You choose the links.<br /><strong>Private until you both approve.</strong></p></div>
          </section>
          <section class="panel auth-panel" aria-labelledby="account-heading">
            <p v-if="hasInvitation" class="message success">You've received an invitation. Create an account or sign in, then choose Join invitation.</p>
            <div class="switcher" aria-label="Account options">
              <button :class="{ selected: mode === 'register' }" :disabled="busy" :aria-pressed="mode === 'register'" @click="mode = 'register'; error = ''; notice = ''">Create account</button>
              <button :class="{ selected: mode === 'sign-in' }" :disabled="busy" :aria-pressed="mode === 'sign-in'" @click="mode = 'sign-in'; error = ''; notice = ''">Sign in</button>
            </div>
            <h2 id="account-heading">{{ mode === 'register' ? 'Make yourself at home.' : 'Welcome back.' }}</h2>
            <p class="muted">{{ mode === 'register' ? 'Create an account to save your first selection.' : 'Sign in to see your saved cards.' }}</p>
            <form @submit.prevent="submitAccount">
              <label for="username">Username</label>
              <input id="username" v-model="username" autocomplete="username" required pattern="[A-Za-z0-9_-]{1,32}" maxlength="32" aria-describedby="username-hint" />
              <small id="username-hint">Letters, numbers, underscores, or hyphens.</small>
              <label for="password">Password</label>
              <input id="password" v-model="password" type="password" :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" required maxlength="128" />
              <button class="primary full" :disabled="busy">{{ busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in' }}</button>
            </form>
          </section>
        </div>

        <section v-else id="your-profiles" tabindex="-1">
          <p class="eyebrow">YOUR PROFILES / PRIVATE SELECTIONS</p>
          <h1>What would you like to share?</h1>
          <p class="lead">Choose 1–5 public pages. Nothing is shared when you save a card.</p>
          <div class="workspace">
            <section class="panel" aria-labelledby="new-card-heading">
              <div class="panel-heading"><h2 id="new-card-heading">Create a card</h2><span class="count">{{ urls.length }} / 5</span></div>
              <div class="source-picker">
              <SourceSearch :key="account.user" :selected="urls" @select="addSearchURL" @expired="showError('UNAUTHORIZED')" />
              <form @submit.prevent="saveCard">
                <h3>Your selection</h3>
                <label for="card-label">Save this selection as</label>
                <input id="card-label" v-model="label" required maxlength="80" placeholder="Portfolio + club bio" />
                <label for="card-urls">Public page links</label>
                <textarea id="card-urls" v-model="links" rows="3" required placeholder="https://your-website.com/about&#10;https://your-club.org/people/you" aria-describedby="links-hint"></textarea>
                <small id="links-hint">One HTTPS link per line, up to five. Choose pages about you that you're comfortable sharing.</small>
                <fieldset v-if="urls.length > 0 && urls.length <= 5" class="page-types"><legend>Choose each page type</legend><p class="muted">Only these categories appear to the other person before approval.</p><div v-for="(url, i) in urls" :key="`${i}-${url}`" class="selected-page"><div class="selection-heading"><label :for="`type-${i}`">{{ url }}</label><button type="button" class="text-button" :aria-label="`Remove ${url}`" @click="removeURL(url)">Remove</button></div><select :id="`type-${i}`" :value="pageTypes[url] ?? 'Public webpage'" @change="pageTypes[url] = ($event.target as HTMLSelectElement).value"><option v-for="category in categoryOptions" :key="category">{{ category }}</option></select></div></fieldset>
                <p v-if="urls.length" class="selection-status" role="status">{{ urls.length }} {{ urls.length === 1 ? 'page' : 'pages' }} selected. Nothing is shared yet.</p>
                <p class="save-note">Saved selections stay fixed. To choose different links, make another card.</p>
                <button class="primary full" :disabled="busy">{{ busy ? 'Saving…' : 'Save private card' }}</button>
              </form>
              </div>
            </section>
            <section class="saved" aria-labelledby="saved-heading">
              <div class="panel-heading"><h2 id="saved-heading">Your saved cards</h2><span class="muted">{{ visibleCards.length }}</span></div>
              <button v-if="cards.some(card => card.archived)" class="text-button" :aria-pressed="showArchived" @click="showArchived = !showArchived">{{ showArchived ? 'Hide archived cards' : 'Show archived cards' }}</button>
              <div v-if="!cards.length" class="empty-state"><span class="empty-mark" aria-hidden="true">▤</span><h3>Your first introduction starts here.</h3><p>Add a few links and give your selection a name. You'll find your saved cards here.</p></div>
              <p v-if="cards.length && !visibleCards.length" class="muted">All your cards are archived. Create a new card to start another exchange.</p>
              <article v-for="card in visibleCards" :key="card.card" class="saved-card">
                <div class="panel-heading"><h3>{{ card.label }}</h3><span class="badge">{{ card.archived ? 'Archived' : 'Saved' }}</span></div>
                <ul><li v-for="url in card.urls" :key="url"><a :href="url" target="_blank" rel="noopener noreferrer">{{ url }} <span aria-hidden="true">↗</span></a></li></ul>
                <p class="card-footer">{{ card.pageTypes.join(' · ') }} · Sharing managed per exchange</p>
                <template v-if="!card.archived">
                  <div v-if="archiveTarget === card.card" class="card-confirmation">
                    <p>Archive this card? It cannot be used for new exchanges. Existing active exchanges keep their access until you end them. To use these links again, save a new card.</p>
                    <button class="primary" :disabled="archiving" @click="archiveCard(card.card)">{{ archiving ? 'Archiving…' : 'Archive card' }}</button>
                    <button class="text-button" :disabled="archiving" @click="archiveTarget = null">Keep card</button>
                  </div>
                  <button v-else class="text-button" :disabled="archiving" @click="archiveTarget = card.card">Archive</button>
                </template>
              </article>
            </section>
          </div>
          <Exchanges :key="account.user" :cards="cards" :username="account.username" @expired="showError('UNAUTHORIZED')" />
        </section>
      </template>
    </main>
    <footer>Knowbody <span>Choose what people get to know.</span></footer>
  </div>
</template>
