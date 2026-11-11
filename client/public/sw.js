// Owlet's service worker. It exists so phones treat Owlet as an installable app (which is what makes it appear in
// the share menu). It deliberately caches nothing: every request goes straight to the network, so people
// never see an old version of the site or someone else's cached data.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // no respondWith: the browser handles the request as usual
});