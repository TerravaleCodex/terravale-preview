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
assert(party.includes('codex-shared-sidebar-frame'),'Session Room must include shared navigation');
assert(party.includes('shared-sidebar/?current=party&v=native-20261101'),'Session Room must request fresh native navigation');
console.log("PASS: SSR renders only native collapsible navigation; Session Room shares it; no overlay or old campaign picker");
