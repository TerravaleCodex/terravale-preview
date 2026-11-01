#!/usr/bin/env node
"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve("site");const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const homepage=read("index.html"),shared=read("shared-sidebar/index.html"),party=read("party/index.html");
for(const [name,source] of [["home",homepage],["Session Room shared navigation",shared]]){
 for(const needle of ['class="sidebar-nav"','class="sidebar-search','class="sidebar-help','class="sidebar-nav-section"','data-tour-nav="/party"','data-tour-nav="/appearance"']){
  assert(source.includes(needle),name+" is missing "+needle);
 }
 assert(!source.includes('site-theme-quick'),name+" still renders the old theme switch");
 assert(!source.includes('topbar-search'),name+" still renders the old topbar Search");
 const aside=source.match(/<aside[^>]*>[\s\S]*?<\/aside>/)?.[0]||"";
 assert(aside,'Missing full native sidebar');
 assert(!aside.includes('Active campaign'),'Campaign selector must stay in Campaign Hub');
 assert(!aside.includes('class="sidebar-label">NAVIGATION'),'Old sidebar was not replaced');
}
assert(homepage.includes('class="user-avatar"'),'Native React avatar missing');
assert(!homepage.includes('navigation-refresh.js?v=20261101-nav1'),'Old DOM overlay must never run');
assert(!homepage.includes('navigation-refresh.css?v=20261101-nav1'),'Old overlay CSS must never run');
assert(shared.includes('terravale.ui.sidebar.groups.v1'),'Static shared nav missing accordion logic');
assert(shared.includes('native-20261101')===false,'Standalone sidebar should not iframe itself');
assert(party.includes('id="room-native-nav"'),'Session Room must contain the same source-built sidebar HTML directly');
const roomSidebar=party.match(/<aside id="room-native-nav"[^>]*>[\s\S]*?<\/aside>/)?.[0]||"";
assert(roomSidebar,'The native room sidebar must be fully present');
const selectedRoom=roomSidebar.match(/<a\b[^>]*data-tour-nav="\/party"[^>]*>/)?.[0]||"";
assert(selectedRoom.includes("room-nav-current")&&selectedRoom.includes('aria-current="page"'),
  'Session Room selection must use an isolated class and aria-current');
assert(!/class="[^"]*\bactive\b/.test(roomSidebar),
  'Global .active from the combat panel must never appear on sidebar links');
assert(!roomSidebar.match(/data-tour-nav="\/"[^>]*aria-current="page"/),
  'Dashboard must not stay active while the Room is selected');
assert(!party.includes('codex-shared-sidebar-frame'),'Production room must not download a second navigation document');
assert(party.includes('room-nav-inline.css')&&party.includes('room-nav-inline.js'),'Native room styles and actions must load');
assert(party.includes('id="codex-theme-before-paint"'),'Saved theme must be chosen before first CSS paint');
assert(party.indexOf('codex-theme-before-paint')<party.indexOf('session-room-v2-codex.css'),'Theme preload must run before stylesheets');
assert(!party.includes('class="nav-head"'),'Legacy standalone sidebar must be absent');
console.log("PASS: SSR renders only native collapsible navigation; Session Room inlines it; no iframe, overlay or legacy sidebar");
