// Runs inside the dashboard page itself (manifest: "world": "MAIN"), so it can see the page's own
// localStorage calls. When the dashboard logs in, logs out or drops an expired token, it tells bridge.ts
// straight away. It never reads or sends the token anywhere else.
const KEY = "token";

function announce() {
  let token: string | null = null;
  try {
    token = localStorage.getItem(KEY);
  } catch {
    /* storage blocked */
  }
  window.postMessage({ owletBridge: true, token }, location.origin);
}

const proto = Storage.prototype;
const { setItem, removeItem, clear } = proto;

proto.setItem = function (this: Storage, key: string, value: string) {
  setItem.call(this, key, value);
  if (this === window.localStorage && key === KEY) announce();
};
proto.removeItem = function (this: Storage, key: string) {
  removeItem.call(this, key);
  if (this === window.localStorage && key === KEY) announce();
};
proto.clear = function (this: Storage) {
  clear.call(this);
  if (this === window.localStorage) announce();
};
