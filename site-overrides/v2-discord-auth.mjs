/* Terravale V2 hosted Discord authentication & identity layer.
 * Uses public Supabase publishable credentials; all protected operations use RLS.
 * The verified identity is read from auth.identities by the server RPC.
 */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.89.0/+esm";

const SUPABASE_URL = "https://emwlvbmnrrhxhrmlwkhs.supabase.co";
const PUBLISHABLE = "sb_publishable_4kf7TddSu-mzjRGr2J5ACA_OrNFF_5T";
const AVATAR_BUCKET = "terravale-profile-avatars";
const supabase = createClient(SUPABASE_URL, PUBLISHABLE, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true }
});
const state = { user: null, profile: null, ready: false };
window.TerravaleVerifiedAccount = { supabase, state, openProfile: () => openProfile() };

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
};
function safeImage(url) {
  try { const u = new URL(String(url || "")); return u.protocol === "https:" ? u.href : ""; }
  catch { return ""; }
}
function avatarUrl(profile) {
  if (!profile) return "";
  if (profile.custom_avatar_path) {
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(profile.custom_avatar_path);
    return safeImage(data?.publicUrl);
  }
  return safeImage(profile.discord_avatar_url);
}
function avatar(profile, className = "") {
  const imageUrl = avatarUrl(profile);
  if (imageUrl) {
    const img = el("img", className);
    img.src = imageUrl;
    img.alt = profile.discord_username + " profile picture";
    img.referrerPolicy = "no-referrer";
    return img;
  }
  const fallback = el("span", className + " tv-avatar", (profile?.discord_username || "?").slice(0, 1).toUpperCase());
  fallback.style.display = "grid"; fallback.style.placeItems = "center"; return fallback;
}

const gate = el("div");
gate.id = "tv-v2-auth-gate";
gate.innerHTML = `<section class="tv-auth-card" role="status" aria-live="polite">
  <span class="tv-eyebrow">TERRAVALE · THE LIVING CODEX</span>
  <h1>Connecting your story.</h1>
  <p id="tv-auth-msg">Checking your Discord session…</p>
  <p class="tv-error" id="tv-auth-error"></p>
  <button class="tv-primary" type="button" id="tv-auth-retry" hidden>Continue with Discord</button>
</section>`;
document.body.append(gate);
const gateMsg = gate.querySelector("#tv-auth-msg");
const gateErr = gate.querySelector("#tv-auth-error");
const gateRetry = gate.querySelector("#tv-auth-retry");
gateRetry.addEventListener("click", () => startDiscord(true));
const say = (message, error = "") => { gateMsg.textContent = message; gateErr.textContent = error; };
function showGate(message, error = "", retry = false) {
  say(message, error); gate.hidden = false; gateRetry.hidden = !retry;
}
function hideGate() { gate.hidden = true; }

async function startDiscord(isRetry = false) {
  if (location.protocol === "file:") {
    showGate("Real Discord sign-in works on the hosted Terravale site, not file:// previews.",
      "Open https://terravalecodex.github.io/terravale-preview/veiled-codex/.", false);
    return;
  }
  if (isRetry) sessionStorage.removeItem("tv-v2-oauth-started");
  if (sessionStorage.getItem("tv-v2-oauth-started") === "1") {
    showGate("Discord sign-in did not complete.", "Try again, or check the site's Discord OAuth redirect settings.", true);
    return;
  }
  showGate("Opening Discord to verify your account…");
  sessionStorage.setItem("tv-v2-oauth-started", "1");
  try {
    const redirectTo = location.origin + location.pathname;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord", options: { redirectTo }
    });
    if (error) throw error;
  } catch (error) {
    sessionStorage.removeItem("tv-v2-oauth-started");
    showGate("Discord connection could not start.", error?.message || String(error), true);
  }
}
async function initAuth() {
  if (location.protocol === "file:") {
    showGate("This package can preview V2 styling, but Discord needs the hosted site.",
      "No simulated Discord UID can grant DM access.", false);
    return;
  }
  const params = new URLSearchParams(location.search);
  if (params.has("error")) {
    sessionStorage.removeItem("tv-v2-oauth-started");
    showGate("Discord did not authorise the connection.", params.get("error_description") || params.get("error"), true);
    return;
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) { await startDiscord(); return; }
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw userError || new Error("Unable to verify Discord session");
    const { data: profile, error: profileError } = await supabase.rpc("terravale_sync_discord_profile");
    if (profileError || !profile?.discord_uid) throw profileError || new Error("Discord identity missing");
    sessionStorage.removeItem("tv-v2-oauth-started");
    state.user = userData.user;
    state.profile = profile;
    state.ready = true;
    clearOldShowcaseOnce();
    hideGate();
    updateVerifiedRole();
    mountAccount();
    window.dispatchEvent(new CustomEvent("terravale-auth-ready", { detail: { isDm: Boolean(profile.is_dm) } }));
    startPageObserver();
  } catch (error) {
    showGate("Unable to confirm your Discord account.", error?.message || String(error), true);
  }
}

function clearOldShowcaseOnce() {
  // Remove V2 sample records from the actual V2 browser store, not merely hide them.
  // A versioned per-account marker preserves all future user-created local records.
  const key = "tv-v2-cleared-real-samples-v3";
  let lastAccount = "";
  try { lastAccount = localStorage.getItem(key) || ""; } catch {}
  if (lastAccount === state.user.id) return;
  if (typeof window.TerravaleClearDemoWorkspace !== "function" ||
      !window.TerravaleClearDemoWorkspace()) {
    throw new Error("Cannot clear V2 showcase state safely; no workspace was modified.");
  }
  localStorage.removeItem("terravalecodex-v238-heritage-preview");
  localStorage.removeItem("terravalecodex-v238-tvuid-preview");
  localStorage.setItem(key, state.user.id);
}

function updateVerifiedRole() {
  const roleButton = document.querySelector("#previewTray [data-role='" + (state.profile?.is_dm ? "dm" : "player") + "']");
  roleButton?.click();
}

let modal = null;
function ensureModal() {
  if (modal) return modal;
  modal = el("div", "tv-account-modal-backdrop");
  modal.hidden = true;
  modal.innerHTML = `<section class="tv-account-modal" role="dialog" aria-modal="true" aria-labelledby="tv-acc-heading">
    <div class="tv-heading"><div><div class="tv-eyebrow">THE LIVING CODEX · DISCORD ACCOUNT</div>
      <h2 id="tv-acc-heading">Your identity</h2></div><button type="button" id="tv-acc-close" aria-label="Close profile">×</button></div>
    <div class="tv-person" id="tv-acc-person"></div>
    <div class="tv-id-grid"><div><small>TvUID · short identifier</small><code id="tv-acc-short"></code></div>
      <div><small>Discord username</small><code id="tv-acc-name"></code></div>
      <div style="grid-column:1/-1"><small>Discord UID · verified, permanent</small><code id="tv-acc-discord"></code></div></div>
    <p class="tv-hint">Your Discord avatar is used automatically unless you upload a custom picture.</p>
    <input id="tv-acc-photo" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload profile picture">
    <div class="tv-account-actions"><button type="button" id="tv-acc-restore">Use Discord picture</button>
      <button type="button" id="tv-acc-copy">Copy TvUID</button>
      <button type="button" id="tv-acc-signout">Sign out</button></div>
    <p class="tv-status" id="tv-acc-status" aria-live="polite"></p>
    <p class="tv-hint">Account and avatar changes are saved online. Characters and campaigns are still browser-local V2 previews, not cloud saved. Switching Discord accounts clears that local preview workspace.</p>
    <div id="tv-acc-directory" class="tv-directory" hidden><div class="tv-eyebrow">DM ONLY · CONNECTED DISCORD ACCOUNTS</div>
      <h2>Player directory</h2><div id="tv-acc-players"></div></div>
  </section>`;
  document.body.append(modal);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeProfile(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeProfile(); });
  modal.querySelector("#tv-acc-close").onclick = closeProfile;
  modal.querySelector("#tv-acc-copy").onclick = async () => {
    try { await navigator.clipboard.writeText(state.profile.tvuid); profileStatus("Copied " + state.profile.tvuid); }
    catch { profileStatus("Copy " + state.profile.tvuid + " manually."); }
  };
  modal.querySelector("#tv-acc-restore").onclick = () => updateCustomAvatar(null);
  modal.querySelector("#tv-acc-photo").onchange = event => uploadAvatar(event.target.files?.[0]);
  modal.querySelector("#tv-acc-signout").onclick = async () => {
    closeProfile();
    await supabase.auth.signOut();
    state.user = null; state.profile = null; state.ready = false;
    showGate("Signed out of Terravale.", "Reload to connect with Discord again.", true);
  };
  return modal;
}
function profileStatus(message) { ensureModal().querySelector("#tv-acc-status").textContent = message; }
async function updateCustomAvatar(path) {
  if (!state.user) return;
  const { error } = await supabase.from("terravale_profiles")
    .update({ custom_avatar_path: path }).eq("user_id", state.user.id);
  if (error) { profileStatus(error.message); return; }
  state.profile.custom_avatar_path = path;
  profileStatus(path ? "Custom profile picture saved." : "Discord profile picture restored.");
  fillProfile(); mountAccount(true);
}
async function uploadAvatar(file) {
  if (!file) return;
  const types = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  if (!types[file.type]) return profileStatus("Choose a PNG, JPEG or WebP image.");
  if (file.size > 2097152) return profileStatus("Profile pictures must be no larger than 2 MB.");
  const path = state.user.id + "/avatar." + types[file.type];
  profileStatus("Uploading picture…");
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file,
    { upsert: true, contentType: file.type, cacheControl: "60" });
  if (error) return profileStatus("Upload failed: " + error.message);
  await updateCustomAvatar(path);
}
function fillProfile() {
  if (!state.profile) return;
  const m = ensureModal(), p = state.profile;
  const person = m.querySelector("#tv-acc-person");
  person.replaceChildren(avatar(p, "tv-avatar"));
  const detail = el("div");
  detail.append(el("strong", "", p.discord_username), el("small", "", p.tvuid + (p.is_dm ? " · Dungeon Master" : " · Adventurer")));
  person.append(detail);
  m.querySelector("#tv-acc-short").textContent = p.tvuid;
  m.querySelector("#tv-acc-name").textContent = p.discord_username;
  m.querySelector("#tv-acc-discord").textContent = p.discord_uid;
  m.querySelector("#tv-acc-directory").hidden = !p.is_dm;
}
async function loadDirectory() {
  if (!state.profile?.is_dm) return;
  const container = ensureModal().querySelector("#tv-acc-players");
  container.replaceChildren(el("p", "tv-hint", "Loading connected Discord accounts…"));
  const { data, error } = await supabase.from("terravale_profiles")
    .select("tvuid,discord_uid,discord_username,discord_avatar_url,custom_avatar_path")
    .order("tvuid").limit(250);
  if (error) { container.replaceChildren(el("p", "tv-hint", error.message)); return; }
  container.replaceChildren();
  for (const p of data || []) {
    const row = el("div", "tv-player");
    row.append(avatar(p));
    const copy = el("div");
    copy.append(el("strong", "", p.tvuid + " · " + p.discord_username),
      el("small", "", "Discord UID: " + p.discord_uid));
    row.append(copy); container.append(row);
  }
}

// Keep the existing DM Chronicle intact; add a verified Discord account register.
async function mountDmChronicleDirectory() {
  if (!state.profile?.is_dm) return;
  const route = location.hash.toLowerCase();
  if (!route.includes("/dm") && !route.includes("chronicle")) return;
  const root = document.getElementById("pageRoot");
  if (!root || root.querySelector("#tv-dm-verified-players")) return;
  const panel = el("section", "tv-dm-verified-players");
  panel.id = "tv-dm-verified-players";
  const heading = el("div", "tv-eyebrow", "DM CHRONICLE · VERIFIED ACCOUNTS");
  const title = el("h2", "", "Connected Discord players");
  const description = el("p", "tv-hint", "Permanent Discord identity, current username and short TvUID. This directory is visible only to the verified site DM.");
  const list = el("div");
  panel.append(heading, title, description, list);
  root.append(panel);
  const { data, error } = await supabase.from("terravale_profiles")
    .select("tvuid,discord_uid,discord_username,discord_avatar_url,custom_avatar_path")
    .order("tvuid").limit(250);
  if (!panel.isConnected) return;
  if (error) { list.replaceChildren(el("p", "tv-hint", error.message)); return; }
  list.replaceChildren();
  for (const profile of data || []) {
    const row = el("div", "tv-dm-player");
    row.append(avatar(profile));
    const names = el("div");
    names.append(el("strong", "", profile.tvuid + " · " + profile.discord_username),
      el("small", "", profile.discord_uid));
    row.append(names);list.append(row);
  }
}

function openProfile() {
  if (!state.profile) return;
  const m = ensureModal();
  fillProfile(); profileStatus(""); m.hidden = false;
  loadDirectory();
  m.querySelector("#tv-acc-close").focus();
}
function closeProfile() { if (modal) modal.hidden = true; }
let accountButton = null;
function mountAccount(force = false) {
  if (!state.profile) return;
  if (!accountButton) {
    accountButton = el("button", "tv-account-btn");
    accountButton.id = "tv-verified-account";
    accountButton.type = "button";
    accountButton.onclick = openProfile;
  }
  const p = state.profile;
  const signature = [p.tvuid, p.discord_username, p.discord_avatar_url, p.custom_avatar_path].join("|");
  if (force || accountButton.dataset.signature !== signature) {
  accountButton.replaceChildren(avatar(p), (() => {
    const meta = el("span", "tv-account-meta");
    meta.append(el("strong", "", p.discord_username), el("small", "", p.tvuid));
    return meta;
  })());
  accountButton.dataset.signature = signature;
  }
  const candidates = Array.from(document.querySelectorAll("button"))
    .filter(b => b !== accountButton && /\bTraveller\b/i.test(b.textContent || ""));
  const source = candidates.find(b => !b.closest("#tv-v2-auth-gate"));
  if (source && source.parentNode) {
    source.replaceWith(accountButton);
    accountButton.removeAttribute("style");
  } else if (!accountButton.isConnected) {
    const fallback = el("div");
    fallback.id = "tv-account-fallback";
    fallback.append(accountButton);
    document.body.append(fallback);
  }
}
let observerStarted = false, mountQueued = false;
function startPageObserver() {
  if (observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(() => {
    if (mountQueued) return;
    mountQueued = true;
    requestAnimationFrame(() => { mountQueued = false; if (state.profile) { mountAccount(); mountDmChronicleDirectory(); } });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(() => { mountAccount(); mountDmChronicleDirectory(); }, 100));
  mountDmChronicleDirectory();
}
await initAuth();
