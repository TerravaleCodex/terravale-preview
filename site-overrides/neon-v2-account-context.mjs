/**
 * Adapt verified Neon staging account bootstrap to the account state that
 * Terravale V2's character logic expects.
 *
 * Not a replacement for Supabase's auth manager yet. No sessions, tokens,
 * storage, database mutation, or browser globals are written here.
 *
 * Trust boundary: only call this with the result of the *authenticated*
 * staging-only terravale_neon_staging_account_bootstrap() RPC. Never accept
 * client-supplied account IDs, names or roles as proof of ownership.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function text(value,max){
  if(typeof value!=="string"||!value.trim()||value.length>max)
    throw new TypeError("Invalid original Terravale account profile");
  return value;
}
function optionalText(value,max){
  if(value===null||value===undefined||value==="")return null;
  if(typeof value!=="string"||value.length>max)throw new TypeError("Invalid optional account profile field");
  return value;
}
export function buildV2ReadOnlyAccountContext(payload) {
  if(!payload || typeof payload!=="object" || Array.isArray(payload) ||
      payload.verified!==true || payload.profile_exists!==true ||
      payload.read_only!==true || typeof payload.is_dm!=="boolean"){
    throw new TypeError("Neon did not verify the original Discord account and profile");
  }
  const userId=text(payload.user_id,36);
  if(!UUID.test(userId))throw new TypeError("Invalid original owner ID");
  const discordUid=text(payload.discord_uid,128);
  const profile=Object.freeze({
    user_id:userId,
    tvuid:text(payload.tvuid,64),
    discord_uid:discordUid,
    discord_username:text(payload.discord_username,128),
    discord_avatar_url:optionalText(payload.discord_avatar_url,2048),
    custom_avatar_path:optionalText(payload.custom_avatar_path,1024),
    is_dm:payload.is_dm,
  });
  // Keep the original user ID: V2 .owned() and .formatRemote() compare this
  // to character owner_id. The Neon Auth UUID must never silently replace it.
  const state=Object.freeze({user:Object.freeze({id:userId}),profile,ready:true});
  return Object.freeze({
    state,
    readOnly:true,
    migrationSource:"neon-staging",
  });
}

/**
 * A newly deployed PostgREST function can produce a temporary HTTP 404 if
 * Neon's API schema cache has not learned its signature yet. Fall back only
 * for that exact status to the existing, previously verified, read-only
 * character-preview RPC, which now includes *only the caller's own profile*.
 * Reject 401/403/5xx: never route around an actual permission failure.
 */
export async function loadVerifiedV2AccountProfile(readBridge, directResult) {
  if (directResult && !directResult.error) {
    return {data:directResult.data,error:null,usedFallback:false};
  }
  if (directResult?.error?.status !== 404) {
    return {data:null,error:directResult?.error||{message:"V2 profile could not be loaded"},usedFallback:false};
  }
  const fallback=await readBridge.rpc("terravale_neon_staging_character_preview");
  if (fallback?.error) {
    return {data:null,error:{message:"V2 profile fallback failed: "+fallback.error.message},usedFallback:true};
  }
  const preview=Array.isArray(fallback?.data)?fallback.data[0]:fallback?.data;
  const profile=preview?.account;
  if(preview?.read_only!==true || !profile || typeof profile!=="object" ||
     profile.verified!==true || profile.profile_exists!==true ||
     profile.read_only!==true){
    return {data:null,error:{message:"No verified original account was returned from Neon staging"},usedFallback:true};
  }
  // Reuse the same strict profile guard as the direct route.
  buildV2ReadOnlyAccountContext(profile);
  return {data:profile,error:null,usedFallback:true};
}
