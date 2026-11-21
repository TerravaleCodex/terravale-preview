/**
 * Read-only Neon staging -> EXISTING V2 embedded-sheet payload.
 * Does not reproduce the V2 UI, call the database, or save anything.
 * Original V2 sheet-render-fixed-20261101/ consumes TV_SHEET_LOAD.
 * Some V2.87 custom boon/spell-slot fields remain outside this older
 * embedded renderer; this is a compatibility preview, not cutover.
 */
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim().slice(0,500) : fallback;
function number(value, fallback, min = -10000, max = 10000) {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}
function namedList(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0,150).map(v => typeof v === "string" ? v : record(v) ? v.name : null)
    .filter(v => typeof v === "string" && v.length > 0).map(v => v.slice(0,160));
}
export function toV2ReadOnlySheet(raw, expectedId) {
  if (!record(raw) || raw.read_only !== true || !record(raw.character) ||
      !record(raw.character.approved_build) || !record(raw.state) ||
      !["owned","dm"].includes(raw.character.access) ||
      typeof expectedId !== "string" || raw.character.id !== expectedId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedId)) {
    throw new TypeError("No verified owner/DM read-only sheet");
  }
  const build = raw.character.approved_build;
  const character = record(build.character) ? build.character : null;
  if (!character) throw new TypeError("Original approved character build is unavailable");
  // Do not fabricate ability scores; a missing set must be investigated.
  const stats = ["str","dex","con","int","wis","cha"].map(k => number(character[k], null, 1, 40));
  if (stats.some(v => v === null)) throw new TypeError("Original approved ability scores are incomplete");
  const level = number(character.level ?? build.level, null, 1, 20);
  const maxHp = number(character.maxHp ?? build.maxHp, null, 0, 5000);
  const ac = number(character.ac, null, 0, 200);
  const speed = number(character.speed, null, 0, 1000);
  const className = text(character.className || build.className || build.class);
  const ancestry = text(character.ancestry || build.ancestry);
  if (level === null || maxHp === null || ac === null || speed === null || !className || !ancestry) {
    throw new TypeError("Original approved V2 sheet is missing required statistics");
  }
  const state = raw.state;
  const inv = Array.isArray(state.inventory) ? state.inventory :
    Array.isArray(character.inventory) ? character.inventory : [];
  const resources = Array.isArray(state.resources) ? state.resources.filter(record) : [];
  const featureSource = Array.isArray(character.features) ? character.features : [];
  // The saved build can carry non-UI fields, but send only the names, stats,
  // resources and items the existing embedded renderer understands.
  const payload = {
    id: expectedId,
    name: text(raw.character.name || character.name, "Adventurer"),
    className, ancestry, level, maxHp, ac, speed, stats,
    pb: number(character.proficiency, 2 + Math.floor((level - 1) / 4), 1, 20),
    hp: number(state.hp, number(character.hp, maxHp), 0, 5000),
    tempHp: number(state.temp_hp, 0, 0, 5000),
    bloodState: number(state.blood_state, number(character.bloodState, 0), -100, 100),
    crimsonStage: number(character.crimsonStage, 1, 1, 6),
    skills: namedList(character.skills),
    saves: namedList(character.savingThrows),
    features: namedList(featureSource),
    resources: resources.slice(0,100).map((r,i) => ({
      id: text(r.id, "neon-resource-"+i),
      name: text(r.name || r.label, "Tracked resource"),
      current: number(r.current, 0, -10000, 10000),
      max: number(r.max, 0, 0, 10000)
    })),
    inventory: inv.slice(0,200).filter(record).map((item,i) => ({
      id: text(item.id, "neon-item-"+i),
      name: text(item.name, "Unnamed inventory entry"),
      description: text(item.description),
      qty: number(item.qty ?? item.quantity, 1, 0, 100000),
      slot: text(item.slot),
      twoHanded: item.twoHanded === true
    })),
    conditions: Array.isArray(state.conditions) ? state.conditions.slice(0,100) : [],
    deathSaves: record(state.death_saves) ? state.death_saves : {},
    summary: text(build.summary || character.concept),
    readOnly: true,
    canDM: false,
    // Private portraits have not yet moved into Neon staging. No Supabase
    // session, signed URL, or media credentials are sent to the iframe.
    portraitUrl: ""
  };
  return Object.freeze(payload);
}
