
/* Operate on the original V2 store, not a second mock store. */
window.TerravaleClearDemoWorkspace = function () {
  if (typeof db === 'undefined' || typeof persist !== 'function' || typeof renderPage !== 'function') return false;
  db.campaigns = [];
  db.characters = [];
  db.campaign = '';
  db.mode = 'empty';
  db.notes = [];
  db.queue = [];
  db.chat = [];
  db.activity = [];
  db.featuredCharacters = {};
  db.v229Featured = {};
  db.v230MainFeatured = {};
  db.sessionRoster = [];
  db.pendingApprovals = [];
  persist();
  renderPage(false);
  return true;
};
