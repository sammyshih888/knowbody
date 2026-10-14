<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { api, type Card, type Exchange } from "./api.ts";
import SourceBrief from "./SourceBrief.vue";

const props = defineProps<{ cards: Card[] }>();
const emit = defineEmits<{ expired: [] }>();
const exchanges = ref<Exchange[]>([]);
const inviteCard = ref("");
const invitation = ref(new URLSearchParams(window.location.hash.slice(1)).get("invite") ?? "");
const selections = ref<Record<string, string>>({});
const consent = ref<Record<string, number | null>>({});
const error = ref("");
const notice = ref("");
const busy = ref(false);
const refreshing = ref(false);
const unavailable = ref(false);
let timer: ReturnType<typeof setInterval>;
let disposed = false;
let refreshVersion = 0;
const ownCard = (entry: Exchange) => props.cards.find(card => card.card === entry.summary.ownItem);
const invitationLink = (token: string) => `${window.location.origin}/#invite=${token}`;

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
      ? "This invitation cannot be joined. It may already be claimed, ended, or belong to your own account."
      : "The exchange changed. Review its current state, then try again.",
  };
  error.value = messages[code] ?? "Couldn't update the exchange. Please try again.";
}

async function refresh() {
  if (disposed) return;
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
      : action === "join" ? "You've joined. Choose a card to offer; your links stay private."
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
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) { error.value = "Paste a complete invitation link or code."; return; }
  await act("join", async () => {
    const result = await api.exchanges.join({ invitation: token });
    if (!("error" in result)) { invitation.value = ""; window.history.replaceState(null, "", window.location.pathname); }
    return result;
  });
}
async function copy(token: string) {
  try { await navigator.clipboard.writeText(invitationLink(token)); notice.value = "Invitation link copied."; }
  catch { notice.value = "Select the invitation link below to copy it."; }
}
const createInvitation = () => act("invite", () => api.exchanges.invite({ card: inviteCard.value }));
const saveOffer = (entry: Exchange) => act("offer", () => api.exchanges.offer({
  exchange: entry.exchange, card: selections.value[entry.exchange]!, revision: entry.summary.revision,
}));
const approveExchange = (entry: Exchange) => act("approve", () => api.exchanges.approve({ exchange: entry.exchange, revision: entry.summary.revision }));
const endExchange = (entry: Exchange) => act("end", async () => {
  const result = await api.exchanges.end({ exchange: entry.exchange });
  if (!("error" in result)) {
    entry.summary.status = "ENDED";
    entry.shared = { card: null, label: null, urls: null, pageTypes: null, brief: { report: null, details: null } };
    if (entry.ownBrief.details?.status === "PENDING") entry.ownBrief.details.status = "CANCELLED";
  }
  return result;
});
function focusRefresh() { if (!document.hidden && !busy.value && !refreshing.value) void refresh(); }
function readInvitation() { invitation.value = new URLSearchParams(window.location.hash.slice(1)).get("invite") ?? ""; }
onMounted(() => {
  void refresh();
  timer = setInterval(focusRefresh, 3000);
  document.addEventListener("visibilitychange", focusRefresh);
  window.addEventListener("hashchange", readInvitation);
});
onUnmounted(() => {
  disposed = true;
  clearInterval(timer);
  document.removeEventListener("visibilitychange", focusRefresh);
  window.removeEventListener("hashchange", readInvitation);
});
</script>

<template>
  <section class="exchanges-section" aria-labelledby="exchanges-heading">
    <p class="eyebrow">A MUTUAL INTRODUCTION</p>
    <div class="panel-heading"><h2 id="exchanges-heading">Your exchanges</h2><span class="badge">Private until mutual approval</span></div>
    <p class="muted">Create an invitation or join one you've received. Both approve the same selection before exact links and source briefs are shared.</p>
    <div v-if="error" class="message error" role="alert">{{ error }}</div>
    <div v-if="notice" class="message success" role="status">{{ notice }}</div>
    <div v-if="unavailable" class="message error" role="status">Updates are unavailable. The last displayed state may be out of date. <button class="text-button" :disabled="busy || refreshing" @click="refresh">Retry</button></div>
    <div class="workspace exchange-actions">
      <form class="panel" @submit.prevent="createInvitation">
        <h3>Invite someone</h3>
        <label for="invite-card">Your first offer</label>
        <select id="invite-card" v-model="inviteCard" required :disabled="busy || !cards.some(card => !card.archived)">
          <option value="" disabled>Save a card first</option>
          <option v-for="card in cards.filter(card => !card.archived)" :key="card.card" :value="card.card">{{ card.label }}</option>
        </select>
        <small>You send the link yourself. They can join once.</small>
        <button class="primary full" :disabled="busy || !inviteCard">Create invitation</button>
      </form>
      <form class="panel" @submit.prevent="join">
        <h3>Have an invitation?</h3>
        <label for="invitation">Invitation link or code</label>
        <input id="invitation" v-model="invitation" required autocomplete="off" placeholder="Paste the invitation here" />
        <small>Joining connects your account. It does not share or approve your links.</small>
        <button class="primary full" :disabled="busy || !invitation.trim()">Join invitation</button>
      </form>
    </div>
    <p v-if="!exchanges.length" class="muted">{{ refreshing ? 'Loading your exchanges…' : 'No exchanges yet. Start with one of your saved cards.' }}</p>
    <article v-for="entry in exchanges" :key="entry.exchange" class="saved-card exchange-card">
      <div class="panel-heading"><h3>{{ entry.partner?.username ? `Exchange with ${entry.partner.username}` : entry.summary.status === 'ENDED' ? 'Unclaimed invitation' : 'Waiting for someone to join' }}</h3><span class="badge">{{ entry.summary.status === 'ENDED' ? 'Ended' : entry.summary.status === 'ACTIVE' ? 'Shared' : 'Not shared' }}</span></div>
      <p v-if="entry.partner?.username && entry.summary.status === 'OPEN'" class="muted">Check that <strong>{{ entry.partner.username }}</strong> is the account you meant to exchange with.</p>
      <div v-if="entry.summary.invitation" class="invitation-box">
        <label :for="`link-${entry.exchange}`">Your invitation link</label>
        <input :id="`link-${entry.exchange}`" :value="invitationLink(entry.summary.invitation)" readonly @focus="($event.target as HTMLInputElement).select()" />
        <button class="text-button" @click="copy(entry.summary.invitation)">Copy invitation</button>
      </div>
      <div class="offer-grid">
        <div><p class="eyebrow">YOUR OFFER</p><h3>{{ ownCard(entry)?.label ?? (entry.summary.status === 'ENDED' ? 'No offer saved' : 'Choose a card below') }}</h3>
          <ul v-if="ownCard(entry)"><li v-for="url in ownCard(entry)!.urls" :key="url"><a :href="url" target="_blank" rel="noopener noreferrer">{{ url }}</a></li></ul>
          <small>{{ entry.summary.ownPreview ?? 'No offer saved yet.' }}</small>
        </div>
        <div><p class="eyebrow">THEIR OFFER</p>
          <template v-if="entry.summary.status === 'ACTIVE' && entry.shared.card && !unavailable"><h3>{{ entry.shared.label }}</h3><ul><li v-for="url in entry.shared.urls" :key="url"><a :href="url" target="_blank" rel="noopener noreferrer">{{ url }}</a></li></ul><small>{{ entry.shared.pageTypes?.join(' · ') }}</small></template>
          <template v-else-if="entry.summary.status === 'ENDED'"><p>Shared access ended.</p><small>The other person's card and brief are no longer available through this exchange.</small></template>
          <template v-else-if="entry.summary.status === 'ACTIVE'"><p>{{ unavailable ? 'Reconnect to view shared material.' : 'Preparing shared access…' }}</p></template>
          <template v-else><p>{{ entry.summary.otherPreview ?? (entry.partner?.username ? 'Waiting for their selection.' : 'Waiting for someone to join.') }}</p><small v-if="entry.summary.otherPreview">Page types chosen by the owner. Exact links stay hidden.</small></template>
        </div>
      </div>
      <form v-if="entry.summary.status === 'OPEN'" class="offer-form" @submit.prevent="saveOffer(entry)">
        <label :for="`offer-${entry.exchange}`">{{ entry.summary.ownItem ? 'Replace your offer' : 'Choose your offer' }}</label>
        <div class="offer-controls"><select :id="`offer-${entry.exchange}`" v-model="selections[entry.exchange]" required><option value="" disabled>Choose a saved card</option><option v-for="card in cards.filter(card => !card.archived)" :key="card.card" :value="card.card">{{ card.label }}</option></select>
        <button class="primary" :disabled="busy || unavailable || !selections[entry.exchange] || selections[entry.exchange] === entry.summary.ownItem">Save offer</button></div>
        <small v-if="!cards.length">Create a private card above, then select it here.</small>
      </form>
      <section v-if="entry.summary.status === 'OPEN'" class="approval-panel">
        <h3>Approve this selection</h3>
        <p class="muted">Once you both approve, your card's label and exact links are shared, and Knowbody reads those pages to prepare a source brief for each person. Both can read both briefs while the exchange is active.</p>
        <p v-if="!entry.summary.ownItem || !entry.summary.otherPreview" class="muted">Both people need to offer a card first.</p>
        <template v-else>
          <div class="approval-status"><span>{{ entry.summary.ownApproved ? '✓ You approved' : 'Your approval needed' }}</span><span>{{ entry.summary.otherApproved ? '✓ They approved' : 'Waiting for their approval' }}</span></div>
          <template v-if="!entry.summary.ownApproved"><label class="consent"><input type="checkbox" :checked="consent[entry.exchange] === entry.summary.revision" @change="consent[entry.exchange] = ($event.target as HTMLInputElement).checked ? entry.summary.revision : null" /><span>I recognize {{ entry.partner?.username }} and agree to share this selection and its source brief.</span></label><button class="primary" :disabled="busy || unavailable || consent[entry.exchange] !== entry.summary.revision" @click="approveExchange(entry)">Approve and share when mutual</button></template>
          <small>Replacing either offer clears both approvals.</small>
        </template>
      </section>
      <div v-if="entry.summary.status === 'ACTIVE' && !unavailable" class="brief-grid">
        <SourceBrief :details="entry.shared.brief.details" :heading="`${entry.partner?.username ?? 'Their'} source brief`" />
        <details class="own-brief"><summary>Your source brief · {{ entry.ownBrief.details?.status === 'READY' ? 'Ready' : entry.ownBrief.details?.status === 'FAILED' ? 'Unavailable' : 'Preparing' }}</summary><SourceBrief :details="entry.ownBrief.details" heading="Your source brief" /></details>
      </div>
      <details v-if="entry.summary.status === 'ENDED' && entry.ownBrief.report" class="own-brief"><summary>Your retained source brief</summary><SourceBrief :details="entry.ownBrief.details" heading="Your source brief" /></details>
      <p v-if="entry.summary.status === 'ACTIVE'" class="muted">Either person can end shared access. Information already seen or copied cannot be taken back.</p>
      <div class="exchange-footer"><span class="muted">Selection revision {{ entry.summary.revision }}</span><button v-if="entry.summary.status !== 'ENDED'" class="text-button" :disabled="busy || unavailable" @click="endExchange(entry)">End exchange</button></div>
    </article>
  </section>
</template>
