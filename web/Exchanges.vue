<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, type Card, type Exchange } from "./api.ts";
import SourceBrief from "./SourceBrief.vue";

defineOptions({ inheritAttrs: false });
const route = useRoute();
const router = useRouter();
const props = defineProps<{ cards: Card[]; username: string }>();
const availableCards = computed(() => props.cards.filter(card => !card.archived));
const emit = defineEmits<{ expired: [] }>();
const exchanges = ref<Exchange[]>([]);
const inviteCard = ref("");
const linkedInvitation = computed(() => new URLSearchParams(route.hash.slice(1)).get("invite") ?? "");
const invitation = ref("");
watch(linkedInvitation, token => { invitation.value = token; }, { immediate: true });
const selections = ref<Record<string, string>>({});
const consent = ref<Record<string, number | null>>({});
const error = ref("");
const errorBox = ref<HTMLElement | null>(null);
watch(error, async message => {
  if (message) { await nextTick(); errorBox.value?.focus(); }
});
const notice = ref("");
const busy = ref(false);
const refreshing = ref(false);
const loaded = ref(false);
const showEnded = ref(false);
const creating = computed(() => route.name === "new-exchange");
const incomingInvitation = computed(() => creating.value && !!linkedInvitation.value);
const invitationHeading = ref<HTMLElement | null>(null);
const inviterUsername = ref<string | null>(null);
const invitationPreviewLoading = ref(false);
const invitationPreviewRetry = ref(false);
let invitationPreviewVersion = 0;
const listing = computed(() => route.name === "exchanges");
const currentExchange = computed(() => exchanges.value.find(entry => entry.exchange === route.params.exchange));
const detailEntries = computed(() => !creating.value && !listing.value && currentExchange.value ? [currentExchange.value] : []);
const ongoing = computed(() => exchanges.value.filter(entry => entry.summary.status !== "ENDED"));
const ended = computed(() => exchanges.value.filter(entry => entry.summary.status === "ENDED"));
const visibleExchanges = computed(() => showEnded.value ? ended.value : ongoing.value);
const unavailable = ref(false);
const checkingAccess = ref(true);
const ending = ref<string | null>(null);
const endButton = ref<HTMLButtonElement | null>(null);
const endConfirmation = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;
let active = false;
let disposed = false;
let refreshVersion = 0;
const ownCard = (entry: Exchange) => props.cards.find(card => card.card === entry.summary.ownItem);
const invitationLink = (token: string) => `${window.location.origin}/exchanges/new#invite=${token}`;

const needsNewInvitation = (entry: Exchange) => entry.summary.status === "OPEN" && !entry.partner?.username && !entry.summary.invitation;
const expiryLabel = (expiry: string) => new Date(expiry).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const exchangeTitle = (entry: Exchange) => entry.partner?.username ? `Exchange with ${entry.partner.username}`
  : entry.summary.status === "ENDED" ? "Unclaimed invitation"
  : needsNewInvitation(entry) ? entry.summary.invitationExpiresAt ? "Invitation expired" : "Invitation needs replacing"
  : "Waiting for someone to join";
const pageTitle = computed(() => creating.value ? "Start an exchange" : listing.value ? "Your exchanges"
  : currentExchange.value ? exchangeTitle(currentExchange.value) : "Your exchange");
const pageDescription = computed(() => {
  if (creating.value) return "Choose a saved card and send an invitation, or join an invitation someone sent you. Links stay hidden until you both approve.";
  if (listing.value) return "Exchange cards of public links with another person. Both of you approve before sharing; then you can read the selected pages and their source comparisons.";
  if (currentExchange.value?.summary.status === "ACTIVE") return "You both approved. Your selected links and source briefs are shared until either person ends the exchange.";
  if (currentExchange.value?.summary.status === "ENDED") return "Shared access has ended. You keep your own cards and any completed source briefs about your pages.";
  if (currentExchange.value && needsNewInvitation(currentExchange.value)) return "No one joined and your links are still private. Start a new exchange to send another invitation.";
  if (currentExchange.value && !currentExchange.value.summary.ownItem) return availableCards.value.length
    ? "You've joined. Choose a card to offer; nothing is shared yet."
    : "You've joined, but you need a card to continue. Create one below; nothing is shared yet.";
  return "Review the offered page types. Links stay hidden until you both approve.";
});
function nextStep(entry: Exchange) {
  if (entry.summary.status === "ENDED") return entry.ownBrief.details?.status === "READY"
    ? "Shared access ended. Your own completed brief stays available." : "This exchange has ended. Shared access is closed.";
  if (entry.summary.status === "ACTIVE") return "Your links are shared. Open the exchange to read the source briefs.";
  if (needsNewInvitation(entry)) return "This link can no longer be used. Start a new exchange to invite someone.";
  if (ownCard(entry)?.archived) return "Your offered card is archived. Choose another card before this exchange can be approved.";
  if (!entry.partner?.username) return "Send your invitation link to the person you want to exchange with.";
  if (!entry.summary.ownItem) return "Choose a card to offer. Your links stay private.";
  if (!entry.summary.otherPreview) return "Waiting for their card. Your links stay private.";
  return entry.summary.ownApproved ? "You approved. Waiting for their approval." : "Review the page types and approve when you're ready.";
}
watch(() => route.fullPath, () => {
  error.value = "";
  notice.value = "";
  ending.value = null;
  consent.value = {};
  if (active) {
    void loadInvitationPreview();
    if (incomingInvitation.value) void focusInvitation();
  }
  if (active && !busy.value && route.path.startsWith("/exchanges")) void refresh();
});

watch(() => props.cards, cards => {
  if (!cards.some(card => card.card === inviteCard.value && !card.archived))
    inviteCard.value = cards.find(card => !card.archived)?.card ?? "";
}, { immediate: true });

function failure(code: string, action: string) {
  if (code === "UNAUTHORIZED") { emit("expired"); return; }
  const messages: Record<string, string> = {
    INVALID_REQUEST: "Check the invitation or selection and try again.",
    NOT_FOUND: "That card is no longer available. Choose one of your saved cards.",
    CONFLICT: action === "join"
      ? "This invitation cannot be joined. It may be expired, already claimed, ended, or belong to your own account. Check which account you're signed into, or ask the sender for a new invitation."
      : action === "approve" ? "An offered card may have been archived, or the selection changed. Review the offers and replace any archived card before approving again."
      : "The exchange changed. Review its current state, then try again.",
  };
  error.value = messages[code] ?? "Couldn't update the exchange. Please try again.";
}

async function refresh() {
  if (disposed || !active) return;
  const version = ++refreshVersion;
  refreshing.value = true;
  try {
    const result = await api.exchanges.list({}, { timeoutMs: 8000 });
    if (disposed || version !== refreshVersion) return;
    if ("error" in result) { failure(result.error, "list"); unavailable.value = true; return; }
    for (const next of result.collection.exchanges) {
      const previous = exchanges.value.find(entry => entry.exchange === next.exchange);
      if (previous && previous.summary.revision !== next.summary.revision) consent.value[next.exchange] = null;
    }
    exchanges.value = result.collection.exchanges;
    loaded.value = true;
    checkingAccess.value = false;
    unavailable.value = false;
    for (const entry of exchanges.value) {
      if (!selections.value[entry.exchange]) selections.value[entry.exchange] = entry.summary.ownItem ?? "";
    }
  } catch { if (!disposed && version === refreshVersion) unavailable.value = true; }
  finally { if (version === refreshVersion) refreshing.value = false; }
}

async function act(action: string, run: () => Promise<{ error: string } | object>) {
  error.value = "";
  notice.value = "";
  busy.value = true;
  ++refreshVersion; // Ignore any list request started before this write.
  try {
    const result = await run();
    if ("error" in result) failure(String(result.error), action);
    else notice.value = action === "invite" ? "Invitation ready. Send the link through your existing chat."
      : action === "join" ? availableCards.value.length
        ? "You've joined. Choose a card to offer; your links stay private."
        : "You've joined. Create a card to offer; nothing is shared yet."
      : action === "offer" ? "Offer saved. Your exact links are still private."
      : action === "approve" ? "Approval saved. Sharing starts once both people approve this selection."
      : "Exchange ended. Shared access is removed; your completed briefs remain.";
    await refresh();
  } catch { error.value = "Couldn't connect to Knowbody. Try again when the connection returns."; }
  finally { busy.value = false; refreshing.value = false; }
}

async function join() {
  let token = invitation.value.trim();
  try { if (token.includes("://")) token = new URLSearchParams(new URL(token).hash.slice(1)).get("invite") ?? ""; }
  catch { token = ""; }
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    error.value = incomingInvitation.value ? "This invitation link is incomplete. Ask the sender for a new link." : "Paste a complete invitation link or code.";
    return;
  }
  await act("join", async () => {
    const result = await api.exchanges.join({ invitation: token });
    if (!("error" in result)) {
      invitation.value = "";
      await router.replace({ name: "exchange", params: { exchange: result.exchange } });
    }
    return result;
  });
}
async function loadInvitationPreview() {
  const version = ++invitationPreviewVersion;
  inviterUsername.value = null;
  invitationPreviewLoading.value = false;
  invitationPreviewRetry.value = false;
  if (!active || !incomingInvitation.value) return;
  error.value = "";
  const token = linkedInvitation.value;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    error.value = "This invitation link is incomplete. Ask the sender for a new link.";
    return;
  }
  invitationPreviewLoading.value = true;
  try {
    const result = await api.exchanges.preview({ invitation: token }, { timeoutMs: 8000 });
    if (version !== invitationPreviewVersion || !active) return;
    if ("error" in result) { failure(result.error, "join"); return; }
    inviterUsername.value = result.inviter?.username ?? null;
    if (!inviterUsername.value) failure("CONFLICT", "join");
  } catch {
    if (version !== invitationPreviewVersion || !active) return;
    error.value = "Couldn't check this invitation. Try again when the connection returns.";
    invitationPreviewRetry.value = true;
  } finally {
    if (version === invitationPreviewVersion) invitationPreviewLoading.value = false;
  }
}
async function notNow() {
  invitation.value = "";
  await router.replace({ name: "cards" });
}
async function focusInvitation() {
  await nextTick();
  invitationHeading.value?.focus({ preventScroll: true });
}
async function copy(token: string) {
  try { await navigator.clipboard.writeText(invitationLink(token)); notice.value = "Invitation link copied."; }
  catch { notice.value = "Select the invitation link below to copy it."; }
}
const createInvitation = () => act("invite", async () => {
  const result = await api.exchanges.invite({ card: inviteCard.value });
  if (!("error" in result)) await router.push({ name: "exchange", params: { exchange: result.exchange } });
  return result;
});
const saveOffer = (entry: Exchange) => act("offer", () => api.exchanges.offer({
  exchange: entry.exchange, card: selections.value[entry.exchange]!, revision: entry.summary.revision,
}));
const approveExchange = (entry: Exchange) => act("approve", () => api.exchanges.approve({ exchange: entry.exchange, revision: entry.summary.revision }));
async function confirmEnd(entry: Exchange) {
  ending.value = entry.exchange;
  await nextTick();
  endConfirmation.value?.focus();
}
async function keepExchange() {
  ending.value = null;
  await nextTick();
  endButton.value?.focus();
}
const endExchange = (entry: Exchange) => act("end", async () => {
  const result = await api.exchanges.end({ exchange: entry.exchange });
  if (!("error" in result)) {
    ending.value = null;
    entry.summary.status = "ENDED";
    entry.shared = { card: null, label: null, urls: null, pageTypes: null, brief: { report: null, details: null } };
    if (entry.ownBrief.details?.status === "PENDING") entry.ownBrief.details.status = "CANCELLED";
  }
  return result;
});
function focusRefresh() { if (active && !document.hidden && !busy.value && !refreshing.value) void refresh(); }
onActivated(() => {
  active = true;
  void loadInvitationPreview();
  if (incomingInvitation.value) void focusInvitation();
  checkingAccess.value = true;
  void refresh();
  timer = setInterval(focusRefresh, 3000);
  document.addEventListener("visibilitychange", focusRefresh);
});
onDeactivated(() => {
  active = false;
  ++invitationPreviewVersion;
  ++refreshVersion;
  refreshing.value = false;
  clearInterval(timer);
  document.removeEventListener("visibilitychange", focusRefresh);
});
onUnmounted(() => { disposed = true; });
</script>

<template>
  <section aria-labelledby="exchanges-heading">
    <RouterLink v-if="!listing && !incomingInvitation" class="back-link" to="/exchanges">← All exchanges</RouterLink>
    <p v-if="!incomingInvitation" class="eyebrow">SHARE BY MUTUAL APPROVAL</p>
    <div v-if="!incomingInvitation" class="page-heading"><div>
      <h1 id="exchanges-heading">{{ pageTitle }}</h1>
      <p class="lead">{{ pageDescription }}</p>
    </div>
    <button v-if="!listing && !creating && currentExchange && currentExchange.summary.status !== 'ENDED'" ref="endButton" class="danger-button" :disabled="busy || unavailable || checkingAccess" :aria-expanded="ending === currentExchange.exchange" aria-controls="end-exchange-confirmation" @click="confirmEnd(currentExchange)">End exchange</button>
    </div>
    <div v-if="error && !incomingInvitation" ref="errorBox" class="message error" role="alert" tabindex="-1">{{ error }}</div>
    <div v-if="notice" class="message success" role="status">{{ notice }}</div>
    <div v-if="unavailable && !incomingInvitation" class="message error" role="status">Updates are unavailable. The last displayed state may be out of date. <button class="text-button" :disabled="busy || refreshing" @click="refresh">Retry</button></div>
    <section v-if="!listing && !creating && currentExchange && ending === currentExchange.exchange && currentExchange.summary.status !== 'ENDED'" id="end-exchange-confirmation" ref="endConfirmation" class="end-confirmation" aria-labelledby="end-confirmation-heading" tabindex="-1">
      <h2 id="end-confirmation-heading">End this exchange?</h2>
      <p v-if="currentExchange.summary.status === 'ACTIVE'">Both of you lose access through this exchange to the other's card and brief. Unfinished research stops. Your own cards and completed briefs remain. This cannot take back links or information someone already saved. This exchange cannot be reopened.</p>
      <p v-else>This invitation will close and neither card will be shared. Your saved cards remain. This exchange cannot be reopened.</p>
      <div class="confirmation-actions">
        <button class="danger-button" :disabled="busy || unavailable || checkingAccess" @click="endExchange(currentExchange)">{{ busy ? 'Ending…' : 'Yes, end exchange' }}</button>
        <button class="text-button" :disabled="busy" @click="keepExchange">Keep exchange</button>
      </div>
    </section>
    <form v-if="incomingInvitation" class="invitation-arrival" @submit.prevent="join">
      <p class="eyebrow">INVITATION TO EXCHANGE</p>
      <p class="invitation-account">Signed in as <strong>{{ username }}</strong></p>
      <p v-if="invitationPreviewLoading" class="invitation-from" role="status">Checking invitation…</p>
      <p v-else-if="inviterUsername" class="invitation-from">Invitation from <strong>{{ inviterUsername }}</strong></p>
      <h1 id="exchanges-heading" ref="invitationHeading" tabindex="-1">Join this exchange?</h1>
      <p class="lead">Signing in doesn't join the exchange. Choose whether to continue.</p>
      <div class="invitation-details">
        <p><strong>Joining shows your username to the sender.</strong> You can then choose a card to offer, or create one if you haven't yet.</p>
        <p>Neither person's links are shared until you both approve.</p>
      </div>
      <div v-if="error" ref="errorBox" class="message error" role="alert" tabindex="-1">{{ error }}</div>
      <button v-if="invitationPreviewRetry" type="button" class="text-button" :disabled="busy || invitationPreviewLoading" @click="loadInvitationPreview">Try again</button>
      <div class="invitation-actions">
        <button class="primary" :disabled="busy || invitationPreviewLoading || !inviterUsername">{{ busy ? 'Joining…' : 'Join invitation' }}</button>
        <button type="button" class="invitation-defer" :disabled="busy" @click="notNow">Not now</button>
      </div>
      <p class="invitation-later">Not now returns you to your cards without notifying the sender. You can reopen their link before it expires.</p>
    </form>
    <div v-else-if="creating" class="workspace exchange-actions">
      <form class="panel" @submit.prevent="createInvitation">
        <h2>Invite someone</h2>
        <p v-if="!cards.some(card => !card.archived)" class="muted">Save a private card first. <RouterLink to="/cards/new">Create a card</RouterLink></p>
        <label for="invite-card">Card to offer</label>
        <select id="invite-card" v-model="inviteCard" required :disabled="busy || !cards.some(card => !card.archived)">
          <option value="" disabled>Save a card first</option>
          <option v-for="card in cards.filter(card => !card.archived)" :key="card.card" :value="card.card">{{ card.label }}</option>
        </select>
        <small>Anyone signed in with the link can see your username and join once, within seven days. Send it only to the person you want to exchange with, through your existing chat.</small>
        <button class="primary full" :disabled="busy || !inviteCard">Create invitation</button>
      </form>
      <form class="panel" @submit.prevent="join">
        <h2>Have an invitation?</h2>
        <label for="invitation">Invitation link or code</label>
        <input id="invitation" v-model="invitation" required autocomplete="off" placeholder="Paste the invitation here" />
        <small>Joining connects your account. It does not share or approve your links.</small>
        <button class="primary full" :disabled="busy || !invitation.trim()">Join invitation</button>
      </form>
    </div>
    <template v-if="listing">
      <div class="list-filters" aria-label="Exchange status">
        <button :class="{ selected: !showEnded }" :aria-pressed="!showEnded" @click="showEnded = false">Ongoing <span>{{ ongoing.length }}</span></button>
        <button :class="{ selected: showEnded }" :aria-pressed="showEnded" @click="showEnded = true">Ended <span>{{ ended.length }}</span></button>
      </div>
      <p v-if="!loaded && !unavailable" class="muted" role="status">Loading your exchanges…</p>
      <div v-else-if="loaded && !visibleExchanges.length" class="empty-state">
        <h2>{{ showEnded ? 'No ended exchanges.' : 'No ongoing exchanges.' }}</h2>
        <p>{{ showEnded ? 'Exchanges you end will appear here.' : 'Choose a private card to offer, or join an invitation someone sent you.' }}</p>
        <RouterLink v-if="!showEnded" class="primary button-link" to="/exchanges/new">Start an exchange</RouterLink>
      </div>
      <ul v-else class="exchange-list">
        <li v-for="entry in visibleExchanges" :key="entry.exchange">
          <RouterLink :to="`/exchanges/${encodeURIComponent(entry.exchange)}`" class="exchange-row">
            <span class="participant-initial" aria-hidden="true">{{ entry.partner?.username?.charAt(0).toUpperCase() ?? '?' }}</span>
            <div class="exchange-row-content"><h2>{{ exchangeTitle(entry) }}</h2><p>{{ nextStep(entry) }}</p><small v-if="ownCard(entry)">Your card: {{ ownCard(entry)!.label }}</small></div>
            <span class="badge" :class="{ 'badge-neutral': entry.summary.status !== 'ACTIVE' }">{{ entry.summary.status === 'ENDED' ? 'Ended' : entry.summary.status === 'ACTIVE' ? 'Shared' : 'Not shared' }}</span>
            <span class="row-arrow" aria-hidden="true">↗</span>
          </RouterLink>
        </li>
      </ul>
    </template>
    <template v-else-if="!creating && !currentExchange">
      <p v-if="(!loaded || refreshing || busy) && !unavailable" class="muted" role="status">Loading your exchange…</p>
      <div v-else-if="!unavailable" class="empty-state"><h2>Exchange not available.</h2><p>This link may be incorrect or belong to another account.</p><RouterLink class="back-link" to="/exchanges">Go to your exchanges</RouterLink></div>
    </template>
    <article v-for="entry in detailEntries" :key="entry.exchange" class="saved-card exchange-card">
      <div class="panel-heading"><h2>Selected cards</h2><span class="badge" :class="{ 'badge-neutral': entry.summary.status !== 'ACTIVE' }">{{ entry.summary.status === 'ENDED' ? 'Ended' : entry.summary.status === 'ACTIVE' ? 'Shared' : 'Not shared' }}</span></div>
      <p v-if="ownCard(entry)?.archived && entry.summary.status === 'OPEN' && !needsNewInvitation(entry)" class="message error" role="status">Your offered card is archived. Choose another card under Replace your offer before either person can approve. You can also end this exchange.</p>
      <p v-else-if="ownCard(entry)?.archived && entry.summary.status === 'ACTIVE'" class="muted">Your card is archived, but you both approved sharing it earlier. Use End exchange to remove shared access.</p>
      <p v-if="entry.partner?.username && entry.summary.status === 'OPEN'" class="muted">Confirm <strong>{{ entry.partner.username }}</strong> through your existing chat before approving. Knowbody does not verify who owns an account.</p>
      <div v-if="entry.summary.invitation" class="invitation-box">
        <label :for="`link-${entry.exchange}`">Your invitation link</label>
        <input :id="`link-${entry.exchange}`" :value="invitationLink(entry.summary.invitation)" readonly @focus="($event.target as HTMLInputElement).select()" />
        <button class="text-button" @click="copy(entry.summary.invitation)">Copy invitation</button>
        <small v-if="entry.summary.invitationExpiresAt">Single use · Expires {{ expiryLabel(entry.summary.invitationExpiresAt) }}. End exchange cancels this invitation.</small>
      </div>
      <div v-else-if="needsNewInvitation(entry)" class="invitation-box">
        <p>{{ entry.summary.invitationExpiresAt ? `This unused invitation expired on ${expiryLabel(entry.summary.invitationExpiresAt)}.` : 'This older invitation has no expiry date, so it can no longer be used.' }} Your card is still private.</p>
        <RouterLink class="primary button-link" to="/exchanges/new">Start a new exchange</RouterLink>
        <small>You can end this exchange to move it out of your ongoing list.</small>
      </div>
      <section v-if="entry.summary.status === 'OPEN' && !needsNewInvitation(entry) && !availableCards.length" class="missing-card">
        <h3>{{ cards.length ? 'Your cards are all archived.' : "You don't have any cards yet." }}</h3>
        <p>Both people need to offer a card before either can approve. Create one with the public pages you want to share, then return here to save your offer.</p>
        <RouterLink class="primary button-link" :to="{ name: 'new-card', query: { exchange: entry.exchange } }">Create a card</RouterLink>
        <small>You can also leave this exchange waiting and return later. Nothing is shared yet.</small>
      </section>
      <div class="offer-grid">
        <section class="offer-side">
          <div class="participant"><span class="participant-initial" aria-hidden="true">{{ username.charAt(0).toUpperCase() }}</span><h3>You · {{ username }}</h3></div>
          <div class="offer-details"><p class="eyebrow">YOUR SELECTED CARD</p><h4>{{ ownCard(entry)?.label ?? (entry.summary.status === 'ENDED' ? 'No offer saved' : 'No card offered yet') }}</h4>
          <ul v-if="ownCard(entry)"><li v-for="url in ownCard(entry)!.urls" :key="url"><a :href="url" target="_blank" rel="noopener noreferrer">{{ url }}</a></li></ul>
          <small>{{ entry.summary.ownPreview ?? (entry.summary.status === 'ENDED' ? 'No card was offered.' : availableCards.length ? 'Choose a saved card below.' : 'Create a card to make an offer.') }}</small></div>
          <p v-if="entry.summary.status === 'OPEN' && entry.summary.ownItem && entry.summary.otherPreview" class="approval-status"><span class="approval-mark" :class="{ approved: entry.summary.ownApproved }" aria-hidden="true">{{ entry.summary.ownApproved ? '✓' : '' }}</span>{{ entry.summary.ownApproved ? 'You approved' : 'Awaiting your approval' }}</p>
        </section>
        <section class="offer-side">
          <div class="participant"><span class="participant-initial" aria-hidden="true">{{ entry.partner?.username?.charAt(0).toUpperCase() ?? '?' }}</span><h3>{{ entry.partner?.username ?? 'Your partner' }}</h3></div>
          <div class="offer-details"><p class="eyebrow">{{ entry.summary.status === 'ACTIVE' ? 'SHARED CARD' : 'OFFERED PAGE TYPES' }}</p>
          <template v-if="entry.summary.status === 'ACTIVE' && entry.shared.card && !unavailable && !checkingAccess"><h4>{{ entry.shared.label }}</h4><ul><li v-for="url in entry.shared.urls" :key="url"><a :href="url" target="_blank" rel="noopener noreferrer">{{ url }}</a></li></ul><small>{{ entry.shared.pageTypes?.join(' · ') }}</small></template>
          <template v-else-if="entry.summary.status === 'ENDED'"><p>Shared access ended.</p><small>The other person's card and brief are no longer available through this exchange.</small></template>
          <template v-else-if="entry.summary.status === 'ACTIVE'"><p>{{ unavailable ? 'Reconnect to view shared material.' : checkingAccess ? 'Checking shared access…' : 'Preparing shared access…' }}</p></template>
          <template v-else><ul v-if="entry.summary.otherPreview" class="preview-types"><li v-for="(pageType, index) in entry.summary.otherPreview.split(', ')" :key="index">{{ pageType }}</li></ul><p v-else>{{ entry.partner?.username ? 'Waiting for their selection.' : needsNewInvitation(entry) ? 'No one joined this invitation.' : 'Waiting for someone to join.' }}</p><small v-if="entry.summary.otherPreview">Page types chosen by the owner. Exact links stay hidden.</small></template>
          </div>
          <p v-if="entry.summary.status === 'OPEN' && entry.summary.ownItem && entry.summary.otherPreview" class="approval-status"><span class="approval-mark" :class="{ approved: entry.summary.otherApproved }" aria-hidden="true">{{ entry.summary.otherApproved ? '✓' : '' }}</span>{{ entry.summary.otherApproved ? 'They approved' : 'Awaiting their approval' }}</p>
        </section>
      </div>
      <form v-if="entry.summary.status === 'OPEN' && !needsNewInvitation(entry) && availableCards.length" class="offer-form" @submit.prevent="saveOffer(entry)">
        <label :for="`offer-${entry.exchange}`">{{ entry.summary.ownItem ? 'Replace your offer' : 'Choose your offer' }}</label>
        <div class="offer-controls"><select :id="`offer-${entry.exchange}`" v-model="selections[entry.exchange]" required :disabled="!cards.some(card => !card.archived)"><option value="" disabled>Choose a saved card</option><option v-for="card in cards.filter(card => !card.archived)" :key="card.card" :value="card.card">{{ card.label }}</option></select>
        <button class="primary" :disabled="busy || unavailable || checkingAccess || !selections[entry.exchange] || selections[entry.exchange] === entry.summary.ownItem">Save offer</button></div>
        <small>Need a different selection? <RouterLink :to="{ name: 'new-card', query: { exchange: entry.exchange } }">Create a new card</RouterLink> and return to this exchange.</small>
      </form>
      <section v-if="entry.summary.status === 'OPEN' && !needsNewInvitation(entry) && availableCards.length" class="approval-panel">
        <h3>Approve this selection</h3>
        <p class="muted">Once you both approve, your card's label and exact links are shared, and Knowbody reads those pages to prepare a source brief for each person. Both can read both briefs while the exchange is active.</p>
        <p class="muted">Shared links can be copied or opened outside Knowbody. Ending the exchange cannot take back information already seen or saved.</p>
        <p v-if="!entry.summary.ownItem || !entry.summary.otherPreview" class="muted">Both people need to offer a card first.</p>
        <template v-else>
          <template v-if="!entry.summary.ownApproved"><label class="consent"><input type="checkbox" :disabled="ownCard(entry)?.archived" :checked="consent[entry.exchange] === entry.summary.revision" @change="consent[entry.exchange] = ($event.target as HTMLInputElement).checked ? entry.summary.revision : null" /><span>I recognize {{ entry.partner?.username }} and agree to share this selection and its source brief.</span></label><button class="primary" :disabled="busy || unavailable || checkingAccess || ownCard(entry)?.archived || consent[entry.exchange] !== entry.summary.revision" @click="approveExchange(entry)">Approve exchange</button></template>
          <small>Replacing either offer clears both approvals.</small>
        </template>
      </section>
      <div v-if="entry.summary.status === 'ACTIVE' && !unavailable && !checkingAccess" class="brief-grid">
        <SourceBrief :details="entry.shared.brief.details" :heading="entry.partner?.username ? `${entry.partner.username}'s source brief` : 'Their source brief'" />
        <details class="own-brief"><summary>Your source brief · {{ entry.ownBrief.details?.status === 'READY' ? 'Ready' : entry.ownBrief.details?.status === 'FAILED' ? 'Unavailable' : 'Preparing' }}</summary><SourceBrief :details="entry.ownBrief.details" heading="Your source brief" /></details>
      </div>
      <details v-if="entry.summary.status === 'ENDED' && entry.ownBrief.report" class="own-brief"><summary>Your retained source brief</summary><SourceBrief :details="entry.ownBrief.details" heading="Your source brief" /></details>
      <p v-if="entry.summary.status === 'ACTIVE'" class="muted">Either person can end shared access. Information already seen or copied cannot be taken back.</p>
    </article>
  </section>
</template>
