import { defineComponent, h, nextTick } from "vue";
import { createRouter, createWebHistory, RouterLink } from "vue-router";
import Cards from "./Cards.vue";
import Exchanges from "./Exchanges.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: to => ({ path: "/cards", hash: to.hash }) },
    { path: "/cards", name: "cards", component: Cards },
    { path: "/cards/new", name: "new-card", component: Cards },
    { path: "/exchanges", name: "exchanges", component: Exchanges },
    { path: "/exchanges/new", name: "new-exchange", component: Exchanges },
    { path: "/exchanges/:exchange", name: "exchange", component: Exchanges },
    {
      path: "/:pathMatch(.*)*",
      component: defineComponent({
        inheritAttrs: false,
        setup: () => () => h("section", [
          h("h1", "Page not found."),
          h("p", "Use your cards or exchanges to pick up where you left off."),
          h(RouterLink, { to: "/exchanges", class: "back-link" }, () => "Go to your exchanges"),
        ]),
      }),
    },
  ],
  async scrollBehavior(_to, _from, savedPosition) {
    await nextTick();
    return savedPosition ?? { top: 0 };
  },
});

router.beforeEach(to => {
  // Keep previously sent /#invite= links working, without putting tokens in query strings.
  if (new URLSearchParams(to.hash.slice(1)).get("invite") && to.name !== "new-exchange")
    return { name: "new-exchange", hash: to.hash, replace: true };
});

router.afterEach(to => {
  const titles: Record<string, string> = {
    cards: "Your cards", "new-card": "New card", exchanges: "Your exchanges",
    "new-exchange": "New exchange", exchange: "Your exchange",
  };
  const incomingInvitation = to.name === "new-exchange" && new URLSearchParams(to.hash.slice(1)).get("invite");
  document.title = `${incomingInvitation ? "Join an exchange" : titles[String(to.name)] ?? "Page not found"} · Knowbody`;
});
