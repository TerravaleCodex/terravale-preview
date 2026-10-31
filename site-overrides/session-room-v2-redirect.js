/* Replaced workshop link: the supported Session Room now lives at
 * /session-room/. Add ?workshop=1 to deliberately open archived V2. */
(function(){
  if(location.protocol!=="https:")return;
  const params=new URLSearchParams(location.search);
  if(params.has("workshop"))return;
  location.replace("/terravale-preview/session-room/");
})();
