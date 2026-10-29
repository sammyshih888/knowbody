<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, type Card } from "./api.ts";
const route = useRoute();
const router = useRouter();

const account = ref<{ user: string; username: string } | null>(null);
const cards = ref<Card[]>([]);
const loading = ref(true);
const busy = ref(false);
const mode = ref<"register" | "sign-in">("register");
const username = ref("");
const password = ref("");
const hasInvitation = computed(() => !!new URLSearchParams(route.hash.slice(1)).get("invite"));
const error = ref("");
const errorBox = ref<HTMLElement | null>(null);
watch(error, async message => {
  if (message) { await nextTick(); errorBox.value?.focus(); }
});
const notice = ref("");
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
    const registering = mode.value === "register";
    const result = registering ? await api.auth.register(credentials) : await api.auth["sign-in"](credentials);
    if ("error" in result) { showError(result.error, registering ? "account" : "sign-in"); return; }
    account.value = { user: result.user, username: credentials.username };
    password.value = "";
    if (registering && !hasInvitation.value) notice.value = "Account created. You're signed in.";
    await loadCards();
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
    notice.value = "";
    mode.value = "sign-in";
    await router.replace("/cards");
  } catch { error.value = "Couldn't sign out. Please try again."; }
  finally { busy.value = false; }
}

watch(() => route.path, async () => {
  error.value = "";
  notice.value = "";
  await nextTick();
  document.getElementById("main-content")?.focus({ preventScroll: true });
});

onMounted(async () => {
  try {
    const current = await api.auth.current({});
    if (!("error" in current)) { account.value = current; await loadCards(); }
    else if (current.error !== "UNAUTHORIZED") showError(current.error);
  } catch { error.value = "Couldn't connect to Knowbody. Please try again."; }
  finally { loading.value = false; }
});
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
      <RouterLink to="/cards" class="brand" aria-label="Knowbody home">knowbody</RouterLink>
      <nav v-if="account" class="section-nav" aria-label="Your workspace"><RouterLink to="/cards" :class="{ current: route.path.startsWith('/cards') }" :aria-current="route.path.startsWith('/cards') ? 'page' : undefined">Cards</RouterLink><RouterLink to="/exchanges" :class="{ current: route.path.startsWith('/exchanges') }" :aria-current="route.path.startsWith('/exchanges') ? 'page' : undefined">Exchanges</RouterLink><RouterLink class="primary button-link top-action" to="/exchanges/new">New exchange</RouterLink></nav>
      <div v-if="account" class="account"><span>{{ account.username }}</span><button class="text-button" :disabled="busy" @click="signOut">Sign out</button></div>
      <span v-else class="header-note">Exchange public profiles by agreement.</span>
    </header>

    <main id="main-content" tabindex="-1">
      <p v-if="loading" class="loading" role="status">Opening Knowbody…</p>
      <template v-else>
        <div v-if="error" ref="errorBox" class="message error" role="alert" tabindex="-1">{{ error }}</div>
        <div v-if="notice" class="message success" role="status">{{ notice }}</div>

        <div v-if="!account" class="welcome">
          <section class="intro">
            <p class="eyebrow">MEET WITH MORE CONTEXT</p>
            <h1>Exchange public profiles<br />before you meet.</h1>
            <p>Knowbody lets two people choose and exchange links to their own public pages. Save your links in a card, invite someone, and both approve before either card is shared.</p>
            <div class="privacy-note"><p>You each choose what to share.<br /><strong>Both approve before cards are shared.</strong></p></div>
          </section>
          <section class="panel auth-panel" aria-labelledby="account-heading">
            <p v-if="hasInvitation" class="message success">You've opened an invitation. Create an account or sign in, then choose whether to join.</p>
            <div class="switcher" aria-label="Account options">
              <button :class="{ selected: mode === 'register' }" :disabled="busy" :aria-pressed="mode === 'register'" @click="mode = 'register'; error = ''; notice = ''">Create account</button>
              <button :class="{ selected: mode === 'sign-in' }" :disabled="busy" :aria-pressed="mode === 'sign-in'" @click="mode = 'sign-in'; error = ''; notice = ''">Sign in</button>
            </div>
            <h2 id="account-heading">{{ mode === 'register' ? 'Create your account' : 'Sign in to Knowbody' }}</h2>
            <p class="muted">{{ hasInvitation ? 'Signing in does not join the exchange or share your links.' : mode === 'register' ? 'Save a private card, then invite someone to exchange cards.' : 'Return to your cards and exchanges.' }}</p>
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

        <RouterView v-else v-slot="{ Component }">
          <KeepAlive :key="account.user">
            <component :is="Component" :cards="cards" :username="account.username" :reload-cards="loadCards" @expired="showError('UNAUTHORIZED')" />
          </KeepAlive>
        </RouterView>
      </template>
    </main>
    <footer>Knowbody <span>Exchange public profiles with mutual approval.</span></footer>
  </div>
</template>
