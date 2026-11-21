/**
 * Terravale Neon staging — strictly read-only subset of V2's Supabase query API.
 *
 * This is a compatibility test, not the live application's replacement client.
 * No insert/update/delete/upsert, no storage URLs, no realtime, no privileged DB
 * credentials. A real Neon Auth JWT is provided on demand by the calling page.
 * Postgres RLS is the actual authorization boundary; these client allowlists
 * reduce the accidental surface exposed by the staging diagnostic UI.
 */
const TABLE_COLUMNS = Object.freeze({
  characters: Object.freeze(["id", "name", "status", "campaign_id"]),
  campaigns: Object.freeze(["id", "name"]),
  campaign_members: Object.freeze(["campaign_id", "user_id", "role"]),
  character_state: Object.freeze(["character_id", "hp", "conditions"]),
});
const RPC_NAMES = Object.freeze([
  "terravale_neon_staging_probe",
  "terravale_neon_staging_character_preview",
  "terravale_neon_staging_account_bootstrap",
]);

function allowedName(value, options) {
  if (typeof value !== "string" || !options.includes(value)) {
    throw new TypeError("Read-only staging request is not on the audited allowlist");
  }
  return value;
}
function safeUuidOrText(v) {
  if ((typeof v !== "string" && typeof v !== "number") ||
      String(v).length > 90 || !/^[a-zA-Z0-9_-]+$/.test(String(v))) {
    throw new TypeError("Unsupported filter value");
  }
  return String(v);
}
function checkedToken(value) {
  if (typeof value !== "string" ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    throw new TypeError("No signed Neon Auth JWT is available");
  }
  return value;
}

export function createNeonReadOnlyBridge({
  dataApiUrl,
  getAccessToken,
  request = globalThis.fetch,
} = {}) {
  // This staging-only helper is deliberately hardwired to the audit API.
  const origin = "https://ep-young-mode-bg86754w.apirest.c-9.eu-central-1.aws.neon.tech";
  const expected = origin + "/terravale/rest/v1";
  if (dataApiUrl !== expected || typeof getAccessToken !== "function" ||
      typeof request !== "function") {
    throw new TypeError("Neon staging data API configuration is invalid");
  }

  async function call(method, path, query = "", body) {
    try {
      const token = checkedToken(await getAccessToken());
      const response = await request(expected + path + query, {
        method,
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/json",
          ...(method === "POST" ? {"Content-Type": "application/json"} : {}),
        },
        ...(method === "POST" ? {body: JSON.stringify(body ?? {})} : {}),
      });
      if (!response.ok) {
        // Do not echo raw backend errors, user identifiers, or tokens in UI.
        return {data: null, error: {message: "Neon staging read denied (HTTP " + response.status + ")"}};
      }
      return {data: await response.json(), error: null};
    } catch (error) {
      return {data: null, error: {message:
        error instanceof TypeError ? "Invalid read-only staging request or session" :
          "Neon staging read could not complete"}};
    }
  }

  function from(table) {
    const columns = TABLE_COLUMNS[allowedName(table, Object.keys(TABLE_COLUMNS))];
    const qs = new URLSearchParams();
    let hasSelect = false;
    const builder = {
      select(fields) {
        if (hasSelect || typeof fields !== "string") {
          throw new TypeError("Specify one explicit audited column selection");
        }
        const requested = fields.split(",").map(x => x.trim());
        if (!requested.length || requested.length > columns.length ||
            new Set(requested).size !== requested.length) {
          throw new TypeError("Invalid read-only selection");
        }
        requested.forEach(c => allowedName(c, columns));
        qs.set("select", requested.join(","));
        hasSelect = true;
        return builder;
      },
      eq(column, value) {
        allowedName(column, columns);
        qs.append(column, "eq." + safeUuidOrText(value));
        return builder;
      },
      in(column, values) {
        allowedName(column, columns);
        if (!Array.isArray(values) || !values.length || values.length > 25) {
          throw new TypeError("Invalid IN filter");
        }
        qs.append(column, "in.(" + values.map(safeUuidOrText).join(",") + ")");
        return builder;
      },
      order(column, {ascending = true} = {}) {
        allowedName(column, columns);
        qs.set("order", column + (ascending ? ".asc" : ".desc"));
        return builder;
      },
      limit(value) {
        if (!Number.isInteger(value) || value < 1 || value > 25) {
          throw new TypeError("Read-only staging result limit must be 1–25");
        }
        qs.set("limit", String(value));
        return builder;
      },
      async execute() {
        if (!hasSelect) {
          return {data: null, error: {message: "An explicit column selection is required"}};
        }
        if (!qs.has("limit")) qs.set("limit", "25");
        return call("GET", "/" + table, "?" + qs.toString());
      },
      then(resolve, reject) {
        return builder.execute().then(resolve, reject);
      },
    };
    return Object.freeze(builder);
  }

  async function rpc(name, args = {}) {
    allowedName(name, RPC_NAMES);
    if (args === null || typeof args !== "object" ||
        Array.isArray(args) || Object.keys(args).length) {
      throw new TypeError("Diagnostic RPCs accept no arguments");
    }
    return call("POST", "/rpc/" + name, "", {});
  }

  return Object.freeze({from, rpc, isReadOnly: true});
}
