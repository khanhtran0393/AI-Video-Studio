/* dedup-same-ast: 993 hàm trùng AST với peer đã xoá khỏi shared-consts.js */
/* ============================================================

   SHARED CONSTS — Tier A refactor 2026-09-10
   11 const/let da tach sang shared-state.js (load truoc)
   File nay chi con function decls + VEO consts (Tool 6)

============================================================ */


// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=157c, shared=157c). Peer load SAU → ghi đè bản này. Sửa ở peer.


// === L?: const KEY_URLS ===
const KEY_URLS = {
  anthropic:  'https://console.anthropic.com/settings/keys',
  openai:     'https://platform.openai.com/api-keys',
  gemini:     'https://aistudio.google.com/apikey',
  deepseek:   'https://platform.deepseek.com/api_keys',
  openrouter: 'https://openrouter.ai/keys',
  groq:       'https://console.groq.com/keys',
  mistral:    'https://console.mistral.ai/api-keys/',
  cohere:     'https://dashboard.cohere.com/api-keys',
  perplexity: 'https://docs.perplexity.ai/',
  together:   'https://api.together.xyz/settings/api-keys',
  fireworks:  'https://fireworks.ai/api-keys',
  'openai-compatible': '#'
};

// === L?: const BRIDGE_FILES ===
const BRIDGE_FILES = {
  "claude-bridge.js": 'LyoqCiAqIENsYXVkZS9Db2RleCBDTEkgQnJpZGdlIOKAlCBiaeG6v24gQ0xJIGfDs2kgc3Vic2NyaXB0aW9uIGPhu6dhIELhuqBOIHRow6BuaCBBUEkga2nhu4N1IE9wZW5BSS4KICoKICogRMO5bmcgxJHhu4MgY2h1a2llbm1lZGlhIChwcm92aWRlciAiQ0xJIHThu7EgaG9zdCIpIGfhu41pIGfDs2kgQ2xhdWRlL0NoYXRHUFQgY+G7p2EgYuG6oW4sCiAqIEtIw5RORyBj4bqnbiBBUEkga2V5IHRy4bqjIHRp4buBbi4gTeG7l2kgdXNlciB04buxIGNo4bqheSBjw6FpIG7DoHkgdHLDqm4gbcOheS9WUFMgY+G7p2EgbcOsbmguCiAqCiAqIFnDilUgQ+G6plU6CiAqICAgMS4gQ8OgaSBDbGF1ZGUgQ29kZSBDTEkgdsOgIMSRxINuZyBuaOG6rXAgYuG6sW5nIGfDs2kgY+G7p2EgYuG6oW4gKFByby9NYXgpOiAgYGNsYXVkZWAgICjEkcSDbmcgbmjhuq1wIDEgbOG6p24pCiAqICAgICAgKEhv4bq3YyBDb2RleCBDTEkgY2hvIGfDs2kgQ2hhdEdQVCDigJQgxJHhu5VpIEVOR0lORSBiw6puIGTGsOG7m2kuKQogKiAgIDIuIENo4bqheTogIG5vZGUgY2xhdWRlLWJyaWRnZS5qcwogKiAgIDMuIFRyb25nIGNodWtpZW5tZWRpYSDihpIgQVBJIFNldHRpbmdzIOKGkiBwcm92aWRlciAiQ0xJIHThu7EgaG9zdCIg4oaSIEVuZHBvaW50OiBodHRwOi8vbG9jYWxob3N0Ojg3OTAKICoKICog4pqg77iPIENo4buJIGTDuW5nIGfDs2kgQ+G7pkEgQuG6oE4gY2hvIHZp4buHYyBj4bunYSBC4bqgTi4gQ2hpYSBz4bq7L2LDoW4gbOG6oWkgcXV54buBbiAxIHTDoGkga2hv4bqjbgogKiAgICBzdWJzY3JpcHRpb24gY2hvIG5oaeG7gXUgbmfGsOG7nWkgbMOgIHZpIHBo4bqhbSDEkWnhu4F1IGtob+G6o24gQW50aHJvcGljL09wZW5BSS4KICovCgpjb25zdCBodHRwID0gcmVxdWlyZSgnaHR0cCcpOwpjb25zdCB7IHNwYXduIH0gPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJyk7Cgpjb25zdCBQT1JUID0gcGFyc2VJbnQocHJvY2Vzcy5lbnYuQlJJREdFX1BPUlQpIHx8IDg3OTA7ICAgICAgIC8vIENsYXVkZT04NzkwLCBDaGF0R1BUPTg3OTEKY29uc3QgRU5HSU5FID0gcHJvY2Vzcy5lbnYuQlJJREdFX0VOR0lORSB8fCAnY2xhdWRlJzsgICAgICAgIC8vICdjbGF1ZGUnIChDbGF1ZGUgQ29kZSkgaG/hurdjICdjb2RleCcgKENoYXRHUFQpCmNvbnN0IFRPS0VOID0gcHJvY2Vzcy5lbnYuQlJJREdFX1RPS0VOIHx8ICcnOyAgICAgICAgICAgICAgICAvLyDEkeG6t3QgY2h14buXaSBiw60gbeG6rXQgbuG6v3UgbXXhu5FuIGLhuqNvIHbhu4cKY29uc3QgTUFYX0NPTkNVUlJFTlQgPSAyOyAgICAgICAgICAgICAgICAvLyBz4buRIGzhu4duaCBDTEkgY2jhuqF5IGPDuW5nIGzDumMgKGfDs2kgc3Vic2NyaXB0aW9uIGPDsyBo4bqhbiBt4bupYyDihpIgxJHhu4MgMS0yKQpjb25zdCBUSU1FT1VUX01TID0gMTgwMDAwOyAgICAgICAgICAgICAgIC8vIGjhur90IDMgcGjDunQgdGjDrCBodeG7tyBs4buHbmggQ0xJIMSRw7MKCi8vIEjDoG5nIMSR4bujaSBnaeG7m2kgaOG6oW4gc+G7kSB0aeG6v24gdHLDrG5oIENMSSBzb25nIHNvbmcuCmxldCBfYWN0aXZlID0gMDsKY29uc3QgX3F1ZXVlID0gW107CmZ1bmN0aW9uIF9hY3F1aXJlKCkgewogIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gewogICAgY29uc3QgdHJ5UnVuID0gKCkgPT4gewogICAgICBpZiAoX2FjdGl2ZSA8IE1BWF9DT05DVVJSRU5UKSB7IF9hY3RpdmUrKzsgcmVzb2x2ZSgpOyB9CiAgICAgIGVsc2UgX3F1ZXVlLnB1c2godHJ5UnVuKTsKICAgIH07CiAgICB0cnlSdW4oKTsKICB9KTsKfQpmdW5jdGlvbiBfcmVsZWFzZSgpIHsKICBfYWN0aXZlLS07CiAgY29uc3QgbmV4dCA9IF9xdWV1ZS5zaGlmdCgpOwogIGlmIChuZXh0KSBuZXh0KCk7Cn0KCmZ1bmN0aW9uIGJ1aWxkUHJvbXB0KG1lc3NhZ2VzKSB7CiAgcmV0dXJuIChtZXNzYWdlcyB8fCBbXSkubWFwKG0gPT4gewogICAgY29uc3QgYyA9IHR5cGVvZiBtLmNvbnRlbnQgPT09ICdzdHJpbmcnCiAgICAgID8gbS5jb250ZW50CiAgICAgIDogKG0uY29udGVudCB8fCBbXSkubWFwKHggPT4geC50ZXh0IHx8ICcnKS5qb2luKCdcbicpOwogICAgY29uc3QgdGFnID0gbS5yb2xlID09PSAnc3lzdGVtJyA/ICdbU3lzdGVtXVxuJyA6IG0ucm9sZSA9PT0gJ2Fzc2lzdGFudCcgPyAnW0Fzc2lzdGFudF1cbicgOiAnJzsKICAgIHJldHVybiB0YWcgKyBjOwogIH0pLmpvaW4oJ1xuXG4nKTsKfQoKYXN5bmMgZnVuY3Rpb24gcnVuQ0xJKHByb21wdCwgbW9kZWwpIHsKICBhd2FpdCBfYWNxdWlyZSgpOwogIHRyeSB7CiAgICByZXR1cm4gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4gewogICAgICBsZXQgY21kLCBhcmdzLCB1c2VTdGRpbiA9IHRydWU7CiAgICAgIGlmIChFTkdJTkUgPT09ICdjb2RleCcpIHsKICAgICAgICAvLyBDb2RleDogYuG7jyBxdWEga2nhu4NtIHRyYSBnaXQgcmVwbywgdHJ1eeG7gW4gcHJvbXB0IGzDoG0gdGhhbSBz4buRIChraMO0bmcgcXVhIHN0ZGluKS4KICAgICAgICBjbWQgPSAnY29kZXgnOyBhcmdzID0gWydleGVjJywgJy0tc2tpcC1naXQtcmVwby1jaGVjaycsIHByb21wdF07IHVzZVN0ZGluID0gZmFsc2U7CiAgICAgIH0gZWxzZSB7CiAgICAgICAgY21kID0gJ2NsYXVkZSc7IGFyZ3MgPSBbJy1wJywgJy0tb3V0cHV0LWZvcm1hdCcsICd0ZXh0J107ICAgLy8gQ2xhdWRlIENvZGUgcHJpbnQgbW9kZSwgxJHhu41jIHN0ZGluCiAgICAgICAgaWYgKG1vZGVsID09PSAnb3B1cycgfHwgbW9kZWwgPT09ICdzb25uZXQnKSBhcmdzLnB1c2goJy0tbW9kZWwnLCBtb2RlbCk7CiAgICAgIH0KICAgICAgY29uc3QgY3AgPSBzcGF3bihjbWQsIGFyZ3MsIHsgZW52OiBwcm9jZXNzLmVudiwgY3dkOiBwcm9jZXNzLmVudi5IT01FIHx8IHVuZGVmaW5lZCwgc2hlbGw6IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMicgfSk7CiAgICAgIGxldCBvdXQgPSAnJywgZXJyID0gJycsIGRvbmUgPSBmYWxzZTsKICAgICAgY29uc3QgZmluaXNoID0gKGZuLCB2KSA9PiB7IGlmIChkb25lKSByZXR1cm47IGRvbmUgPSB0cnVlOyBjbGVhclRpbWVvdXQodGltZXIpOyBmbih2KTsgfTsKICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHsgdHJ5IHsgY3Aua2lsbCgnU0lHS0lMTCcpOyB9IGNhdGNoIHt9IGZpbmlzaChyZWplY3QsIG5ldyBFcnJvcignQ0xJIHRpbWVvdXQnKSk7IH0sIFRJTUVPVVRfTVMpOwogICAgICBjcC5zdGRvdXQub24oJ2RhdGEnLCBkID0+IChvdXQgKz0gZCkpOwogICAgICBjcC5zdGRlcnIub24oJ2RhdGEnLCBkID0+IChlcnIgKz0gZCkpOwogICAgICBjcC5vbignZXJyb3InLCBlID0+IGZpbmlzaChyZWplY3QsIGUpKTsKICAgICAgY3Aub24oJ2Nsb3NlJywgY29kZSA9PiAoY29kZSA9PT0gMCA/IGZpbmlzaChyZXNvbHZlLCBvdXQudHJpbSgpKSA6IGZpbmlzaChyZWplY3QsIG5ldyBFcnJvcihlcnIudHJpbSgpIHx8ICgnZXhpdCAnICsgY29kZSkpKSkpOwogICAgICBpZiAodXNlU3RkaW4pIGNwLnN0ZGluLndyaXRlKHByb21wdCk7CiAgICAgIGNwLnN0ZGluLmVuZCgpOwogICAgfSk7CiAgfSBmaW5hbGx5IHsKICAgIF9yZWxlYXNlKCk7CiAgfQp9CgpmdW5jdGlvbiBjb3JzKHJlcykgewogIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJyk7CiAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsICcqJyk7CiAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcycsICdQT1NULCBPUFRJT05TJyk7Cn0KCmZ1bmN0aW9uIHNlbmRKU09OKHJlcywgb2JqLCBjb2RlID0gMjAwKSB7IHJlcy53cml0ZUhlYWQoY29kZSwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pOyByZXMuZW5kKEpTT04uc3RyaW5naWZ5KG9iaikpOyB9CmZ1bmN0aW9uIHJlYWRCb2R5KHJlcSkgeyByZXR1cm4gbmV3IFByb21pc2UociA9PiB7IGxldCBiID0gJyc7IHJlcS5vbignZGF0YScsIGMgPT4gKGIgKz0gYykpOyByZXEub24oJ2VuZCcsICgpID0+IHIoYikpOyB9KTsgfQoKLy8g4pSA4pSAIMSQxIJORyBOSOG6rFAgUVVBIFdFQiAoQ8OhY2ggQikg4oCUIGtow7RuZyBj4bqnbiB0ZXJtaW5hbCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIAKLy8gQuG7jWMgbOG7h25oIGxvZ2luIGPhu6dhIENMSTogYuG6r3QgVVJMIG7DsyBpbiByYSDihpIgaGnhu4duIGzDqm4gd2ViIOKGkiBuaOG6rW4gY29kZSB04burIHdlYiDihpIgxJHhuql5IHbDoG8gc3RkaW4uCmNvbnN0IExPR0lOX0FSR1MgPSBFTkdJTkUgPT09ICdjb2RleCcgPyBbJ2xvZ2luJ10gOiBbJ3NldHVwLXRva2VuJ107CmxldCBsb2dpbiA9IG51bGw7ICAgLy8geyBwcm9jLCB1cmwsIGRvbmUsIGVycm9yLCBidWYgfQoKZnVuY3Rpb24gc3RhcnRMb2dpblByb2MoKSB7CiAgaWYgKGxvZ2luICYmIGxvZ2luLnByb2MpIHsgdHJ5IHsgbG9naW4ucHJvYy5raWxsKCdTSUdLSUxMJyk7IH0gY2F0Y2gge30gfQogIGxvZ2luID0geyBwcm9jOiBudWxsLCB1cmw6IG51bGwsIGRvbmU6IGZhbHNlLCBlcnJvcjogbnVsbCwgYnVmOiAnJyB9OwogIGNvbnN0IGNwID0gc3Bhd24oRU5HSU5FLCBMT0dJTl9BUkdTLCB7IGVudjogcHJvY2Vzcy5lbnYsIHNoZWxsOiBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInIH0pOwogIGxvZ2luLnByb2MgPSBjcDsKICBjb25zdCBvbkRhdGEgPSBkID0+IHsKICAgIGxvZ2luLmJ1ZiArPSBkLnRvU3RyaW5nKCk7CiAgICBpZiAoIWxvZ2luLnVybCkgeyBjb25zdCBtID0gbG9naW4uYnVmLm1hdGNoKC9odHRwcz86XC9cL1teXHMnIl0rLyk7IGlmIChtKSBsb2dpbi51cmwgPSBtWzBdOyB9CiAgfTsKICBjcC5zdGRvdXQub24oJ2RhdGEnLCBvbkRhdGEpOwogIGNwLnN0ZGVyci5vbignZGF0YScsIG9uRGF0YSk7CiAgY3Aub24oJ2Vycm9yJywgZSA9PiB7IGxvZ2luLmVycm9yID0gZS5tZXNzYWdlOyB9KTsKICBjcC5vbignY2xvc2UnLCBjb2RlID0+IHsgbG9naW4uZG9uZSA9IGNvZGUgPT09IDA7IGlmIChjb2RlICE9PSAwICYmICFsb2dpbi5lcnJvcikgbG9naW4uZXJyb3IgPSAnZXhpdCAnICsgY29kZSArIChsb2dpbi5idWYgPyAnOiAnICsgbG9naW4uYnVmLnNsaWNlKC0yMDApIDogJycpOyB9KTsKfQoKY29uc3QgTE9HSU5fSFRNTCA9IGA8IWRvY3R5cGUgaHRtbD48bWV0YSBjaGFyc2V0PSJ1dGYtOCI+PHRpdGxlPsSQxINuZyBuaOG6rXAgZ8OzaSBDbGF1ZGU8L3RpdGxlPgo8c3R5bGU+Ym9keXtmb250OjE1cHgvMS42IC1hcHBsZS1zeXN0ZW0sU2Vnb2UgVUksUm9ib3RvLHNhbnMtc2VyaWY7bWF4LXdpZHRoOjU2MHB4O21hcmdpbjo0MHB4IGF1dG87cGFkZGluZzowIDIwcHg7Y29sb3I6IzFhMWEyZX0KaDJ7Zm9udC1zaXplOjIwcHh9YnV0dG9ue2JhY2tncm91bmQ6IzdjNWNmZjtjb2xvcjojZmZmO2JvcmRlcjowO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6MTBweCAxNnB4O2ZvbnQtd2VpZ2h0OjYwMDtjdXJzb3I6cG9pbnRlcjtmb250LXNpemU6MTRweH0KYnV0dG9uLmd7YmFja2dyb3VuZDojZWVlO2NvbG9yOiMzMzN9aW5wdXR7d2lkdGg6MTAwJTtwYWRkaW5nOjEwcHg7Ym9yZGVyOjFweCBzb2xpZCAjY2NjO2JvcmRlci1yYWRpdXM6OHB4O2ZvbnQtc2l6ZToxNHB4O2JveC1zaXppbmc6Ym9yZGVyLWJveH0KLmJveHtib3JkZXI6MXB4IHNvbGlkICNlM2UzZWY7Ym9yZGVyLXJhZGl1czoxMnB4O3BhZGRpbmc6MThweDttYXJnaW4tdG9wOjE2cHh9YXtjb2xvcjojN2M1Y2ZmO3dvcmQtYnJlYWs6YnJlYWstYWxsfS5va3tjb2xvcjojMTZhMzRhfS5lcnJ7Y29sb3I6I2RjMjYyNn0ubXV0ZWR7Y29sb3I6Izg4ODtmb250LXNpemU6MTNweH08L3N0eWxlPgo8aDI+8J+UkCDEkMSDbmcgbmjhuq1wIGfDs2kgQ2xhdWRlIChraMO0bmcgY+G6p24gdGVybWluYWwpPC9oMj4KPHAgY2xhc3M9Im11dGVkIj7EkMSDbmcgbmjhuq1wIGLhurFuZyBnw7NpIENsYXVkZS9DaGF0R1BUIGPhu6dhIGLhuqFuIMSR4buDIGJyaWRnZSBkw7luZyDEkcaw4bujYy4gQ2jhu4kgbMOgbSAxIGzhuqduLjwvcD4KPGJ1dHRvbiBpZD0ic3RhcnQiPkLhuq90IMSR4bqndSDEkcSDbmcgbmjhuq1wPC9idXR0b24+CjxkaXYgaWQ9InN0ZXAiIGNsYXNzPSJib3giIHN0eWxlPSJkaXNwbGF5Om5vbmUiPgogIDxkaXY+MS4gTeG7nyBsaW5rIG7DoHkgxJHhu4MgxJHEg25nIG5o4bqtcDo8L2Rpdj4KICA8cD48YSBpZD0idXJsIiB0YXJnZXQ9Il9ibGFuayI+PC9hPjwvcD4KICA8ZGl2PjIuIMSQxINuZyBuaOG6rXAgeG9uZywgbuG6v3UgdHJhbmcgaGnhu4duIDxiPm3DoyAoY29kZSk8L2I+IHRow6wgZMOhbiB2w6BvIMSRw6J5OjwvZGl2PgogIDxpbnB1dCBpZD0iY29kZSIgcGxhY2Vob2xkZXI9IkTDoW4gY29kZSAobuG6v3UgY8OzKSBy4buTaSBi4bqlbSBYw6FjIG5o4bqtbiI+CiAgPHA+PGJ1dHRvbiBpZD0ic3VibWl0Ij5Yw6FjIG5o4bqtbjwvYnV0dG9uPiA8c3BhbiBpZD0ibXNnIiBjbGFzcz0ibXV0ZWQiPjwvc3Bhbj48L3A+CjwvZGl2Pgo8ZGl2IGlkPSJkb25lQm94IiBjbGFzcz0iYm94IG9rIiBzdHlsZT0iZGlzcGxheTpub25lIj7inIUgxJDEg25nIG5o4bqtcCB0aMOgbmggY8O0bmchIEJyaWRnZSDEkcOjIHPhurVuIHPDoG5nLiDEkMOzbmcgdGFiIG7DoHkgxJHGsOG7o2MgcuG7k2kuPC9kaXY+CjxzY3JpcHQ+CmNvbnN0ICQ9aWQ9PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKTtsZXQgcG9sbD1udWxsOwphc3luYyBmdW5jdGlvbiBwb3N0KHUsYil7Y29uc3Qgcj1hd2FpdCBmZXRjaCh1LHttZXRob2Q6J1BPU1QnLGhlYWRlcnM6eydDb250ZW50LVR5cGUnOidhcHBsaWNhdGlvbi9qc29uJ30sYm9keTpiP0pTT04uc3RyaW5naWZ5KGIpOm51bGx9KTtyZXR1cm4gci5qc29uKCl9CmFzeW5jIGZ1bmN0aW9uIHN0YXR1cygpe2NvbnN0IHI9YXdhaXQgZmV0Y2goJy9sb2dpbi9zdGF0dXMnKTtyZXR1cm4gci5qc29uKCl9CmZ1bmN0aW9uIHN0YXJ0UG9sbCgpe2NsZWFySW50ZXJ2YWwocG9sbCk7cG9sbD1zZXRJbnRlcnZhbChhc3luYygpPT57Y29uc3Qgcz1hd2FpdCBzdGF0dXMoKTsKICBpZihzLnVybCYmISQoJ3VybCcpLmhyZWYpeyQoJ3VybCcpLmhyZWY9cy51cmw7JCgndXJsJykudGV4dENvbnRlbnQ9cy51cmw7JCgnc3RlcCcpLnN0eWxlLmRpc3BsYXk9J2Jsb2NrJ30KICBpZihzLmVycm9yKXskKCdtc2cnKS5pbm5lckhUTUw9JzxzcGFuIGNsYXNzPWVycj4nK3MuZXJyb3IrJzwvc3Bhbj4nfQogIGlmKHMuZG9uZSl7Y2xlYXJJbnRlcnZhbChwb2xsKTskKCdzdGVwJykuc3R5bGUuZGlzcGxheT0nbm9uZSc7JCgnZG9uZUJveCcpLnN0eWxlLmRpc3BsYXk9J2Jsb2NrJ30KfSwxNTAwKX0KJCgnc3RhcnQnKS5vbmNsaWNrPWFzeW5jKCk9PnskKCdzdGFydCcpLmRpc2FibGVkPXRydWU7JCgnc3RhcnQnKS50ZXh0Q29udGVudD0nxJBhbmcga2jhu59pIMSR4buZbmcuLi4nO2F3YWl0IHBvc3QoJy9sb2dpbi9zdGFydCcpO3N0YXJ0UG9sbCgpfTsKJCgnc3VibWl0Jykub25jbGljaz1hc3luYygpPT57JCgnbXNnJykudGV4dENvbnRlbnQ9J8SQYW5nIHjDoWMgbmjhuq1uLi4uJzthd2FpdCBwb3N0KCcvbG9naW4vY29kZScse2NvZGU6JCgnY29kZScpLnZhbHVlfSk7fTsKPC9zY3JpcHQ+YDsKCmh0dHAuY3JlYXRlU2VydmVyKGFzeW5jIChyZXEsIHJlcykgPT4gewogIGNvcnMocmVzKTsKICBpZiAocmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7IHJlcy53cml0ZUhlYWQoMjA0KTsgcmV0dXJuIHJlcy5lbmQoKTsgfQogIGNvbnN0IHBhdGggPSAocmVxLnVybCB8fCAnJykuc3BsaXQoJz8nKVswXTsKCiAgLy8gVHJhbmcgxJHEg25nIG5o4bqtcCBxdWEgd2ViIChDw6FjaCBCKQogIGlmIChyZXEubWV0aG9kID09PSAnR0VUJyAmJiBwYXRoID09PSAnL2xvZ2luJykgeyByZXMud3JpdGVIZWFkKDIwMCwgeyAnQ29udGVudC1UeXBlJzogJ3RleHQvaHRtbDsgY2hhcnNldD11dGYtOCcgfSk7IHJldHVybiByZXMuZW5kKExPR0lOX0hUTUwpOyB9CiAgaWYgKHJlcS5tZXRob2QgPT09ICdQT1NUJyAmJiBwYXRoID09PSAnL2xvZ2luL3N0YXJ0JykgeyBzdGFydExvZ2luUHJvYygpOyByZXR1cm4gc2VuZEpTT04ocmVzLCB7IG9rOiB0cnVlIH0pOyB9CiAgaWYgKHJlcS5tZXRob2QgPT09ICdHRVQnICYmIHBhdGggPT09ICcvbG9naW4vc3RhdHVzJykgeyByZXR1cm4gc2VuZEpTT04ocmVzLCBsb2dpbiA/IHsgdXJsOiBsb2dpbi51cmwsIGRvbmU6IGxvZ2luLmRvbmUsIGVycm9yOiBsb2dpbi5lcnJvciB9IDogeyBlcnJvcjogJ2NoxrBhIGLhuq90IMSR4bqndScgfSk7IH0KICBpZiAocmVxLm1ldGhvZCA9PT0gJ1BPU1QnICYmIHBhdGggPT09ICcvbG9naW4vY29kZScpIHsKICAgIGNvbnN0IGIgPSBhd2FpdCByZWFkQm9keShyZXEpOyBsZXQgY29kZSA9ICcnOyB0cnkgeyBjb2RlID0gSlNPTi5wYXJzZShiIHx8ICd7fScpLmNvZGUgfHwgJyc7IH0gY2F0Y2gge30KICAgIGlmICghbG9naW4gfHwgIWxvZ2luLnByb2MpIHJldHVybiBzZW5kSlNPTihyZXMsIHsgZXJyb3I6ICdDaMawYSBi4bqvdCDEkeG6p3UgxJHEg25nIG5o4bqtcC4nIH0sIDQwMCk7CiAgICB0cnkgeyBsb2dpbi5wcm9jLnN0ZGluLndyaXRlKFN0cmluZyhjb2RlKS50cmltKCkgKyAnXG4nKTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gc2VuZEpTT04ocmVzLCB7IGVycm9yOiBlLm1lc3NhZ2UgfSwgNTAwKTsgfQogICAgcmV0dXJuIHNlbmRKU09OKHJlcywgeyBvazogdHJ1ZSB9KTsKICB9CgogIC8vIEFQSSB04bqhbyB2xINuIGLhuqNuIChPcGVuQUktY29tcGF0aWJsZSkgY2hvIGNodWtpZW5tZWRpYQogIGlmIChyZXEubWV0aG9kID09PSAnUE9TVCcgJiYgcGF0aC5pbmNsdWRlcygnL2NoYXQvY29tcGxldGlvbnMnKSkgewogICAgaWYgKFRPS0VOKSB7IGNvbnN0IGF1dGggPSAocmVxLmhlYWRlcnMuYXV0aG9yaXphdGlvbiB8fCAnJykucmVwbGFjZSgvXkJlYXJlclxzKy9pLCAnJyk7IGlmIChhdXRoICE9PSBUT0tFTikgeyByZXMud3JpdGVIZWFkKDQwMSk7IHJldHVybiByZXMuZW5kKCd1bmF1dGhvcml6ZWQnKTsgfSB9CiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEJvZHkocmVxKTsKICAgIHRyeSB7CiAgICAgIGNvbnN0IHsgbWVzc2FnZXMsIG1vZGVsIH0gPSBKU09OLnBhcnNlKGJvZHkgfHwgJ3t9Jyk7CiAgICAgIGNvbnN0IHRleHQgPSBhd2FpdCBydW5DTEkoYnVpbGRQcm9tcHQobWVzc2FnZXMpLCBtb2RlbCk7CiAgICAgIHJldHVybiBzZW5kSlNPTihyZXMsIHsgY2hvaWNlczogW3sgaW5kZXg6IDAsIG1lc3NhZ2U6IHsgcm9sZTogJ2Fzc2lzdGFudCcsIGNvbnRlbnQ6IHRleHQgfSwgZmluaXNoX3JlYXNvbjogJ3N0b3AnIH1dIH0pOwogICAgfSBjYXRjaCAoZSkgewogICAgICBjb25zb2xlLmVycm9yKCdicmlkZ2UgZXJyb3I6JywgZS5tZXNzYWdlIHx8IGUpOwogICAgICByZXR1cm4gc2VuZEpTT04ocmVzLCB7IGVycm9yOiB7IG1lc3NhZ2U6IFN0cmluZyhlLm1lc3NhZ2UgfHwgZSkgfSB9LCA1MDApOwogICAgfQogIH0KCiAgcmVzLndyaXRlSGVhZCg0MDQpOyByZXMuZW5kKCdub3QgZm91bmQnKTsKfSkubGlzdGVuKFBPUlQsICcxMjcuMC4wLjEnLCAoKSA9PiB7ICAgLy8gQ0jhu4ggbG9jYWxob3N0IOKAlCBtw6F5IGtow6FjIHRyb25nIG3huqFuZyBLSMOUTkcgZ+G7jWkgxJHGsOG7o2MKICBjb25zb2xlLmxvZyhg4pyFICR7RU5HSU5FfSBicmlkZ2UgY2jhuqF5IHThuqFpIGh0dHA6Ly9sb2NhbGhvc3Q6JHtQT1JUfSAg4oaSIGTDoW4gdsOgbyBjaHVraWVubWVkaWFgKTsKICBjb25zb2xlLmxvZyhgICAgxJDEg25nIG5o4bqtcCBraMO0bmcgY+G6p24gdGVybWluYWw6IG3hu58gaHR0cDovL2xvY2FsaG9zdDoke1BPUlR9L2xvZ2luYCk7Cn0pOwo=',
  "Bridge.command": 'IyEvYmluL2Jhc2gKIyDEkEnhu4BVIEtISeG7gk4gQlJJREdFIChNYWMpIOKAlCAxIGZpbGUgbMOgbSBo4bq/dC4gQuG6pW0gxJHDunAgxJHhu4MgbeG7nyBtZW51LgpjZCAiJChkaXJuYW1lICIkMCIpIgpESVI9IiQocHdkKSIKQlJJREdFPSIkRElSL2NsYXVkZS1icmlkZ2UuanMiCgplbnN1cmVfbm9kZSgpeyBjb21tYW5kIC12IG5vZGUgPi9kZXYvbnVsbCAyPiYxIHx8IHsgZWNobyAi4p2MIENoxrBhIGPDoGkgTm9kZS5qcy4gTeG7nyBub2RlanMub3JnLCBjw6BpIHLhu5NpIGNo4bqheSBs4bqhaS4iOyBvcGVuIGh0dHBzOi8vbm9kZWpzLm9yZyAyPi9kZXYvbnVsbDsgcmV0dXJuIDE7IH07IH0KZW5zdXJlX2NsaSgpewogIGlmIFsgIiQxIiA9ICJjb2RleCIgXTsgdGhlbiBjb21tYW5kIC12IGNvZGV4ID4vZGV2L251bGwgMj4mMSB8fCB7IGVjaG8gIuKGkiBDw6BpIENvZGV4IENMSS4uLiI7IG5wbSBpbnN0YWxsIC1nIEBvcGVuYWkvY29kZXggMj4vZGV2L251bGwgfHwgc3VkbyBucG0gaW5zdGFsbCAtZyBAb3BlbmFpL2NvZGV4OyB9CiAgZWxzZSBjb21tYW5kIC12IGNsYXVkZSA+L2Rldi9udWxsIDI+JjEgfHwgeyBlY2hvICLihpIgQ8OgaSBDbGF1ZGUgQ0xJLi4uIjsgbnBtIGluc3RhbGwgLWcgQGFudGhyb3BpYy1haS9jbGF1ZGUtY29kZSAyPi9kZXYvbnVsbCB8fCBzdWRvIG5wbSBpbnN0YWxsIC1nIEBhbnRocm9waWMtYWkvY2xhdWRlLWNvZGU7IH07IGZpCn0KCnN0YXJ0X2JnKCl7ICMgZW5naW5lIHBvcnQgbGFiZWwKICBsb2NhbCBlbmdpbmU9JDEgcG9ydD0kMiBsYWJlbD0kMwogIGxvY2FsIE5PREUgTkQgQ0QgUExJU1QKICBOT0RFPSIkKGNvbW1hbmQgLXYgbm9kZSkiOyBORD0iJChkaXJuYW1lICIkTk9ERSIpIgogIENEPSIkKGRpcm5hbWUgIiQoY29tbWFuZCAtdiAke2VuZ2luZS9jb2RleC9jb2RleH0gMj4vZGV2L251bGwgfHwgZWNobyAiJE5EL3giKSIpIgogIFBMSVNUPSIkSE9NRS9MaWJyYXJ5L0xhdW5jaEFnZW50cy8kbGFiZWwucGxpc3QiCiAgbWtkaXIgLXAgIiRIT01FL0xpYnJhcnkvTGF1bmNoQWdlbnRzIgogIGNhdCA+ICIkUExJU1QiIDw8RU9GCjw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04Ij8+CjwhRE9DVFlQRSBwbGlzdCBQVUJMSUMgIi0vL0FwcGxlLy9EVEQgUExJU1QgMS4wLy9FTiIgImh0dHA6Ly93d3cuYXBwbGUuY29tL0RURHMvUHJvcGVydHlMaXN0LTEuMC5kdGQiPgo8cGxpc3QgdmVyc2lvbj0iMS4wIj48ZGljdD4KPGtleT5MYWJlbDwva2V5PjxzdHJpbmc+JGxhYmVsPC9zdHJpbmc+CjxrZXk+UHJvZ3JhbUFyZ3VtZW50czwva2V5PjxhcnJheT48c3RyaW5nPiROT0RFPC9zdHJpbmc+PHN0cmluZz4kQlJJREdFPC9zdHJpbmc+PC9hcnJheT4KPGtleT5FbnZpcm9ubWVudFZhcmlhYmxlczwva2V5PjxkaWN0Pgo8a2V5PkJSSURHRV9FTkdJTkU8L2tleT48c3RyaW5nPiRlbmdpbmU8L3N0cmluZz4KPGtleT5CUklER0VfUE9SVDwva2V5PjxzdHJpbmc+JHBvcnQ8L3N0cmluZz4KPGtleT5QQVRIPC9rZXk+PHN0cmluZz4kTkQ6JENEOi91c3IvYmluOi9iaW46L3Vzci9zYmluOi9zYmluPC9zdHJpbmc+CjxrZXk+SE9NRTwva2V5PjxzdHJpbmc+JEhPTUU8L3N0cmluZz48L2RpY3Q+CjxrZXk+UnVuQXRMb2FkPC9rZXk+PHRydWUvPjxrZXk+S2VlcEFsaXZlPC9rZXk+PHRydWUvPgo8a2V5PlN0YW5kYXJkT3V0UGF0aDwva2V5PjxzdHJpbmc+JERJUi9icmlkZ2UtJGVuZ2luZS5sb2c8L3N0cmluZz4KPGtleT5TdGFuZGFyZEVycm9yUGF0aDwva2V5PjxzdHJpbmc+JERJUi9icmlkZ2UtJGVuZ2luZS5sb2c8L3N0cmluZz4KPC9kaWN0PjwvcGxpc3Q+CkVPRgogIGxhdW5jaGN0bCB1bmxvYWQgIiRQTElTVCIgMj4vZGV2L251bGw7IGxhdW5jaGN0bCBsb2FkICIkUExJU1QiOyBzbGVlcCAxCiAgZWNobyAi4pyFIELhuq10IG7hu4FuOiAke2VuZ2luZX0g4oCUIGPhu5VuZyAke3BvcnR9ICh04buxIGNo4bqheSBraGkgbeG7nyBtw6F5KS4iCn0KCnN0YXR1cygpewogIGZvciBwbiBpbiAiODc5MDpDbGF1ZGUiICI4NzkxOkNoYXRHUFQiOyBkbwogICAgbG9jYWwgcG9ydD0ke3BuJSU6Kn0gbmFtZT0ke3BuIyMqOn0KICAgIGlmIGN1cmwgLXMgLW0gMiAiaHR0cDovL2xvY2FsaG9zdDokcG9ydCIgPi9kZXYvbnVsbCAyPiYxOyB0aGVuIGVjaG8gIuKchSAkbmFtZSAoY+G7lW5nICRwb3J0KSDEkEFORyBDSOG6oFkiOyBlbHNlIGVjaG8gIuKtlSAkbmFtZSAoY+G7lW5nICRwb3J0KSB04bqvdCI7IGZpCiAgZG9uZQp9Cgp3aGlsZSB0cnVlOyBkbwogIGNsZWFyCiAgZWNobyAi4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIEZMT1cgQlJJREdFIOKVkOKVkOKVkOKVkOKVkOKVkOKVkOKVkCIKICBlY2hvICIgMSkg4pa2IELhuq10IENMQVVERSAoY2jhuqF5IG7hu4FuLCBj4buVbmcgODc5MCkiCiAgZWNobyAiIDIpIOKWtiBC4bqtdCBDSEFUR1BUIChjaOG6oXkgbuG7gW4sIGPhu5VuZyA4NzkxKSIKICBlY2hvICIgMykg8J+UkCDEkMSDbmcgbmjhuq1wIENsYXVkZSAobMOgbSAxIGzhuqduKSIKICBlY2hvICIgNCkg8J+UkCDEkMSDbmcgbmjhuq1wIENoYXRHUFQgKGzDoG0gMSBs4bqnbikiCiAgZWNobyAiIDUpIOKWoCBU4bqvdCB04bqldCBj4bqjIGJyaWRnZSIKICBlY2hvICIgNikg8J+UjSBLaeG7g20gdHJhIHRy4bqhbmcgdGjDoWkiCiAgZWNobyAiIDApIFRob8OhdCIKICBlY2hvICLilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZDilZAiCiAgcmVhZCAtcCAiQ2jhu41uIHPhu5E6ICIgYwogIGVjaG8gIiIKICBjYXNlICIkYyIgaW4KICAgIDEpIGVuc3VyZV9ub2RlICYmIGVuc3VyZV9jbGkgY2xhdWRlICYmIHN0YXJ0X2JnIGNsYXVkZSA4NzkwIGNvbS5jaHVraWVuLmNsaWJyaWRnZSA7OwogICAgMikgZW5zdXJlX25vZGUgJiYgZW5zdXJlX2NsaSBjb2RleCAgJiYgc3RhcnRfYmcgY29kZXggIDg3OTEgY29tLmNodWtpZW4uY29kZXhicmlkZ2UgOzsKICAgIDMpIGVuc3VyZV9ub2RlICYmIGVuc3VyZV9jbGkgY2xhdWRlICYmIHsgZWNobyAi4oaSIMSQxINuZyBuaOG6rXAgeG9uZywgZ8O1IC9leGl0IHLhu5NpIEVudGVyLiI7IGNsYXVkZTsgfSA7OwogICAgNCkgZW5zdXJlX25vZGUgJiYgZW5zdXJlX2NsaSBjb2RleCAgJiYgY29kZXggbG9naW4gOzsKICAgIDUpIGxhdW5jaGN0bCB1bmxvYWQgIiRIT01FL0xpYnJhcnkvTGF1bmNoQWdlbnRzL2NvbS5jaHVraWVuLmNsaWJyaWRnZS5wbGlzdCIgMj4vZGV2L251bGw7IGxhdW5jaGN0bCB1bmxvYWQgIiRIT01FL0xpYnJhcnkvTGF1bmNoQWdlbnRzL2NvbS5jaHVraWVuLmNvZGV4YnJpZGdlLnBsaXN0IiAyPi9kZXYvbnVsbDsgZWNobyAi4pagIMSQw6MgdOG6r3QgdOG6pXQgY+G6oy4iIDs7CiAgICA2KSBzdGF0dXMgOzsKICAgIDApIGV4aXQgMCA7OwogICAgKikgZWNobyAiQ2jhu41uIDAtNi4iIDs7CiAgZXNhYwogIGVjaG8gIiI7IHJlYWQgLXAgIk5o4bqlbiBFbnRlciDEkeG7gyB24buBIG1lbnUuLi4iCmRvbmUK',
  "Bridge.bat": 'QGVjaG8gb2ZmCmNoY3AgNjUwMDEgPm51bApjZCAvZCAiJX5kcDAiCgo6bWVudQpjbHMKZWNobyA9PT09PT09PSBGTE9XIEJSSURHRSA9PT09PT09PQplY2hvICAxKSBCYXQgQ0xBVURFIChjaGF5IG5lbiwgY29uZyA4NzkwKQplY2hvICAyKSBCYXQgQ0hBVEdQVCAoY2hheSBuZW4sIGNvbmcgODc5MSkKZWNobyAgMykgRGFuZyBuaGFwIENsYXVkZSAobGFtIDEgbGFuKQplY2hvICA0KSBEYW5nIG5oYXAgQ2hhdEdQVCAobGFtIDEgbGFuKQplY2hvICA1KSBUYXQgdGF0IGNhIGJyaWRnZQplY2hvICA2KSBLaWVtIHRyYSB0cmFuZyB0aGFpCmVjaG8gIDcpIFR1IGJhdCBraGkgbW8gbWF5ICh0aGVtIHZhbyBTdGFydHVwKQplY2hvICAwKSBUaG9hdAplY2hvID09PT09PT09PT09PT09PT09PT09PT09PT09PT09CnNldCAvcCBjPUNob24gc286CmVjaG8uCmlmICIlYyUiPT0iMSIgKCBjYWxsIDplbnN1cmVOb2RlICYmIGNhbGwgOmVuc3VyZUNsYXVkZSAmJiBzdGFydCAiIiB3c2NyaXB0LmV4ZSAiJX5kcDBoaWRkZW4tY2xhdWRlLnZicyIgJiBlY2hvIERhIGJhdCBDTEFVREUgbmVuLiApCmlmICIlYyUiPT0iMiIgKCBjYWxsIDplbnN1cmVOb2RlICYmIGNhbGwgOmVuc3VyZUNvZGV4ICAmJiBzdGFydCAiIiB3c2NyaXB0LmV4ZSAiJX5kcDBoaWRkZW4tY2hhdGdwdC52YnMiICYgZWNobyBEYSBiYXQgQ0hBVEdQVCBuZW4uICkKaWYgIiVjJSI9PSIzIiAoIGNhbGwgOmVuc3VyZUNsYXVkZSAmJiBjbGF1ZGUgKQppZiAiJWMlIj09IjQiICggY2FsbCA6ZW5zdXJlQ29kZXggJiYgY29kZXggbG9naW4gKQppZiAiJWMlIj09IjUiICggdGFza2tpbGwgL0YgL0lNIG5vZGUuZXhlID5udWwgMj5udWwgJiBlY2hvIERhIHRhdCB0YXQgY2EuICkKaWYgIiVjJSI9PSI2IiAoIGNhbGwgOnN0YXR1cyApCmlmICIlYyUiPT0iNyIgKAogIGNvcHkgL1kgIiV+ZHAwaGlkZGVuLWNsYXVkZS52YnMiICAiJUFQUERBVEElXE1pY3Jvc29mdFxXaW5kb3dzXFN0YXJ0IE1lbnVcUHJvZ3JhbXNcU3RhcnR1cFwiID5udWwKICBjb3B5IC9ZICIlfmRwMGhpZGRlbi1jaGF0Z3B0LnZicyIgIiVBUFBEQVRBJVxNaWNyb3NvZnRcV2luZG93c1xTdGFydCBNZW51XFByb2dyYW1zXFN0YXJ0dXBcIiA+bnVsCiAgZWNobyBEYSB0aGVtIHZhbyBTdGFydHVwIC0gdHUgYmF0IGtoaSBtbyBtYXkuCikKaWYgIiVjJSI9PSIwIiBleGl0CmVjaG8uCnBhdXNlCmdvdG8gbWVudQoKOmVuc3VyZU5vZGUKd2hlcmUgbm9kZSA+bnVsIDI+bnVsIHx8ICggZWNobyBDYWkgTm9kZS5qcyB0YWkgbm9kZWpzLm9yZyByb2kgY2hheSBsYWkuICYgc3RhcnQgaHR0cHM6Ly9ub2RlanMub3JnICYgZXhpdCAvYiAxICkKZXhpdCAvYiAwCjplbnN1cmVDbGF1ZGUKd2hlcmUgY2xhdWRlID5udWwgMj5udWwgfHwgKCBlY2hvIENhaSBDbGF1ZGUgQ0xJLi4uICYgY2FsbCBucG0gaW5zdGFsbCAtZyBAYW50aHJvcGljLWFpL2NsYXVkZS1jb2RlICkKZXhpdCAvYiAwCjplbnN1cmVDb2RleAp3aGVyZSBjb2RleCA+bnVsIDI+bnVsIHx8ICggZWNobyBDYWkgQ29kZXggQ0xJLi4uICYgY2FsbCBucG0gaW5zdGFsbCAtZyBAb3BlbmFpL2NvZGV4ICkKZXhpdCAvYiAwCjpzdGF0dXMKY3VybCAtcyAtbSAyIGh0dHA6Ly9sb2NhbGhvc3Q6ODc5MCA+bnVsIDI+bnVsICYmIGVjaG8gQ2xhdWRlIDg3OTA6IERBTkcgQ0hBWSB8fCBlY2hvIENsYXVkZSA4NzkwOiB0YXQKY3VybCAtcyAtbSAyIGh0dHA6Ly9sb2NhbGhvc3Q6ODc5MSA+bnVsIDI+bnVsICYmIGVjaG8gQ2hhdEdQVCA4NzkxOiBEQU5HIENIQVkgfHwgZWNobyBDaGF0R1BUIDg3OTE6IHRhdApleGl0IC9iIDAK',
  "hidden-claude.vbs": 'JyBDaOG6oXkgYnJpZGdlIENsYXVkZSAoY+G7lW5nIDg3OTApIOG6qW4sIGtow7RuZyBoaeG7h24gY+G7rWEgc+G7lS4gQuG6pW0gxJHDunAgxJHhu4MgYuG6rXQgbuG7gW4uClNldCBzaCA9IENyZWF0ZU9iamVjdCgiV1NjcmlwdC5TaGVsbCIpClNldCBmc28gPSBDcmVhdGVPYmplY3QoIlNjcmlwdGluZy5GaWxlU3lzdGVtT2JqZWN0IikKZGlyID0gZnNvLkdldFBhcmVudEZvbGRlck5hbWUoV1NjcmlwdC5TY3JpcHRGdWxsTmFtZSkKc2guQ3VycmVudERpcmVjdG9yeSA9IGRpcgpzaC5SdW4gIm5vZGUgIiIiICYgZGlyICYgIlxjbGF1ZGUtYnJpZGdlLmpzIiIiLCAwLCBGYWxzZQo=',
  "hidden-chatgpt.vbs": 'JyBDaOG6oXkgYnJpZGdlIENoYXRHUFQgKGPhu5VuZyA4NzkxKSDhuqluLCBraMO0bmcgaGnhu4duIGPhu61hIHPhu5UuIELhuqVtIMSRw7pwIMSR4buDIGLhuq10IG7hu4FuLgpTZXQgc2ggPSBDcmVhdGVPYmplY3QoIldTY3JpcHQuU2hlbGwiKQpTZXQgZnNvID0gQ3JlYXRlT2JqZWN0KCJTY3JpcHRpbmcuRmlsZVN5c3RlbU9iamVjdCIpClNldCBlbnYgPSBzaC5FbnZpcm9ubWVudCgiUHJvY2VzcyIpCmVudigiQlJJREdFX0VOR0lORSIpID0gImNvZGV4IgplbnYoIkJSSURHRV9QT1JUIikgPSAiODc5MSIKZGlyID0gZnNvLkdldFBhcmVudEZvbGRlck5hbWUoV1NjcmlwdC5TY3JpcHRGdWxsTmFtZSkKc2guQ3VycmVudERpcmVjdG9yeSA9IGRpcgpzaC5SdW4gIm5vZGUgIiIiICYgZGlyICYgIlxjbGF1ZGUtYnJpZGdlLmpzIiIiLCAwLCBGYWxzZQo=',
  "HUONG-DAN.txt": 'PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KIETDmU5HIEfDk0kgQ0xBVURFIC8gQ0hBVEdQVCBD4bumQSBC4bqgTiBDSE8gQ0hVS0lFTk1FRElBCiAoa2jDtG5nIGPhuqduIG11YSBBUEkga2V5KQo9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQoKQuG6oW4gY2jhuqF5IDEgImJyaWRnZSIgbmjhu48gdHLDqm4gbcOheSAtPiBkw7luZyBjaMOtbmggZ8OzaSBDbGF1ZGUgKFByby9NYXgpCmhv4bq3YyBDaGF0R1BUIChQbHVzL1BybykgY+G7p2EgYuG6oW4gdHJvbmcgdG9vbC4gQ8OgaSAxIEzhuqZOLCBzYXUgxJHDsyB04buxIGNo4bqheS4KCgotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQpCxq/hu5pDIDAg4oCUIEPDgEkgTk9ERS5KUyAobMOgbSAxIGzhuqduKQotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQpWw6BvIHRyYW5nICBub2RlanMub3JnICAtPiB04bqjaSBi4bqjbiBMVFMgLT4gY8OgaSBuaMawIHBo4bqnbiBt4buBbSBiw6xuaCB0aMaw4budbmcuCgoKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KQsav4buaQyAxIOKAlCBN4bueIELhuqJORyDEkEnhu4BVIEtISeG7gk4KLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KLSBNQUM6ICAgICBi4bqlbSDEkcO6cCBmaWxlICBCcmlkZ2UuY29tbWFuZAogICAgICAgICAgIChs4bqnbiDEkeG6p3UgTWFjIGNo4bq3biAtPiBjaHXhu5l0IHBo4bqjaSAtPiBPcGVuIC0+IE9wZW4pCgotIFdJTkRPV1M6IGLhuqVtIMSRw7pwIGZpbGUgIEJyaWRnZS5iYXQKICAgICAgICAgICAoYsOhbyBj4bqjbmggLT4gTW9yZSBpbmZvIC0+IFJ1biBhbnl3YXkpCgpT4bq9IGhp4buHbiBNRU5VIGNo4buNbiBz4buROgogICAgMSkgQuG6rXQgQ0xBVURFIChjaOG6oXkgbuG7gW4pCiAgICAyKSBC4bqtdCBDSEFUR1BUIChjaOG6oXkgbuG7gW4pCiAgICAzKSDEkMSDbmcgbmjhuq1wIENsYXVkZQogICAgNCkgxJDEg25nIG5o4bqtcCBDaGF0R1BUCiAgICA1KSBU4bqvdCB04bqldCBj4bqjCiAgICA2KSBLaeG7g20gdHJhIHRy4bqhbmcgdGjDoWkKICAgIDcpIChXaW5kb3dzKSBU4buxIGLhuq10IGtoaSBt4bufIG3DoXkKCgotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQpCxq/hu5pDIDIg4oCUIMSQxIJORyBOSOG6rFAgKGNo4buJIGzDoG0gMSBs4bqnbikKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KLSBEw7luZyBDTEFVREU6ICBjaOG7jW4gMyAtPiDEkcSDbmcgbmjhuq1wIGfDs2kgQ2xhdWRlIHF1YSB0csOsbmggZHV54buHdAogICAgICAgICAgICAgICAgKMSRxINuZyBuaOG6rXAgeG9uZyBnw7UgIC9leGl0ICBy4buTaSBFbnRlcikKCi0gRMO5bmcgQ0hBVEdQVDogY2jhu41uIDQgLT4gxJHEg25nIG5o4bqtcCBnw7NpIENoYXRHUFQgcXVhIHRyw6xuaCBkdXnhu4d0CgoKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KQsav4buaQyAzIOKAlCBC4bqsVCBCUklER0UKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KLSBDaOG7jW4gMSAoQ2xhdWRlKSB2w6AvaG/hurdjIDIgKENoYXRHUFQpIC0+IGNo4bqheSBu4buBbi4KLSBXaW5kb3dzOiBjaOG7jW4gdGjDqm0gNyDEkeG7gyB04buxIGLhuq10IGtoaSBt4bufIG3DoXkuCgoKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KQsav4buaQyA0IOKAlCBO4buQSSBWw4BPIFRPT0wKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KMS4gTeG7nyAgY2h1a2llbm1lZGlhLmNvbSAgLT4gZ8OzYyB0csOhaSAgQVBJIFNldHRpbmdzCjIuIE5ow6AgY3VuZyBj4bqlcDogIENMSSB04buxIGhvc3QKMy4gTW9kZWw6IGNo4buNbiBDbGF1ZGUgaG/hurdjIENoYXRHUFQgKMSR4buLYSBjaOG7iSB04buxIMSRw7puZyA4NzkwIC8gODc5MSkKNC4gQuG6pW0gIEzGsHUgIC0+ICBUZXN0ICAtPiAgcmEgIkNMSSBob+G6oXQgxJHhu5luZyIgbMOgIFhPTkcuCgpU4burIGdp4budOiBt4bufIG3DoXkgLT4gYnJpZGdlIHThu7EgY2jhuqF5IC0+IGNo4buJIG3hu58gdG9vbCBsw6AgZMO5bmcuCgoKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KSOG7jkkgTkhBTkgKLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0KKiBUZXN0IGLDoW8gIkZhaWxlZCB0byBmZXRjaCI/CiAgLT4gQnJpZGdlIGNoxrBhIGNo4bqheS4gTeG7nyBCcmlkZ2UuY29tbWFuZCAvIEJyaWRnZS5iYXQsIGNo4buNbiAxIChob+G6t2MgMikuCgoqIEtp4buDbSB0cmEgYnJpZGdlIGPDsm4gc+G7kW5nPyAgICAgIC0+IG1lbnUgY2jhu41uIDYuCiogxJDEg25nIG5o4bqtcCBs4bqhaSBt4buXaSBs4bqnbiBraMO0bmc/ICAgLT4gS0jDlE5HLCBjaOG7iSAxIGzhuqduLgoqIMSQw7NuZyBj4butYSBz4buVIGPDsyBzYW8ga2jDtG5nPyAgICAgIC0+IEtow7RuZywgYnJpZGdlIGNo4bqheSBu4buBbi4KKiBE4buvIGxp4buHdSBjw7MgbMOqbiBs4buLY2ggc+G7rSBjaGF0PyAgIC0+IEtow7RuZyBoaeG7h24g4bufIGNsYXVkZS5haS9jaGF0Z3B0LmNvbSwKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmjGsG5nIHbhuqtuIHTDrW5oIHbDoG8gaOG6oW4gbeG7qWMgZ8OzaSBj4bunYSBi4bqhbi4KCkPDoWMgZmlsZSBraMOhYyAoY2xhdWRlLWJyaWRnZS5qcywgaGlkZGVuLSoudmJzLCAqLmxvZykgbMOgIHJ14buZdCBtw6F5LApLSMOUTkcgY+G6p24gYuG6pW0uCj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Cg==',
};

// === L?: let _cliPoll ===
let _cliPoll = null;

// === L?: let _keyVisible ===
let _keyVisible = false;

// === L?: let _upgOrderId, _upgPollTimer, _upgCountTimer ===
let _upgOrderId = null, _upgPollTimer = null, _upgCountTimer = null;

// === L?: const ADMIN_EMAILS ===
const ADMIN_EMAILS = ['admin@novastudio.app', 'admin@novastudio.app', 'admin@novastudio.app'];

// === L?: const ADMIN_UIDS ===
const ADMIN_UIDS = ['UxxIxoq6v1Zk1sa0oc40C7AMuVB3'];

// === L?: const setStatusAdm ===
const setStatusAdm = (m, t) => setStatusBar('statusadm', m, t);

// === L?: const _TF_CFG_IDS ===
const _TF_CFG_IDS = ['tfModel', 'tfAspect', 'tfQuality', 'tfConc', 'tfDelay'];

// === L?: let _updState, _appVer, _updDismissed ===
let _updState = null, _appVer = '', _updDismissed = false;

// === L?: const MAC_DL_URL ===
const MAC_DL_URL = 'https://novastudio-vn.netlify.app/#tai-app';

// === L?: const SUPPORT_ZALO ===
const SUPPORT_ZALO = 'https://zalo.me/0373382451';

// === L?: const SUPPORT_YOUTUBE ===
const SUPPORT_YOUTUBE = 'https://www.youtube.com/@DinoFact200-1';

// === L?: function _dashStats ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=621c, shared=507c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _dashStats(){
  const profiles = (state.profiles || []).length;
  let videos = 0; (state.profiles || []).forEach(p => { videos += Array.isArray(p.videos) ? p.videos.length : 1; });
  const doneTotal = parseInt(localStorage.getItem('av_done_total') || '0') || 0;
  const doneMonth = parseInt(localStorage.getItem('av_done_' + _ymKey()) || '0') || 0;
  const producing = (typeof _autoBusy !== 'undefined' && _autoBusy) ? 1 : 0;
  return { profiles, videos, doneTotal, doneMonth, producing };
}

// === L?: function _dashWorkflow ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1878c, shared=1314c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _dashWorkflow(){
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  const hasStyle = !!(p && (p.characterStyle || p.backgroundStyle || p.sceneStyle));
  const hasScript = (state.script || '').trim().length > 0;
  const nScenes = (state.scenes || []).length;
  const nPrompts = Object.keys(state.scenePrompts || {}).filter(k => state.scenePrompts[k]).length;
  const nImg = Object.keys(state.sceneImages || {}).filter(k => state.sceneImages[k]?.base64).length;
  const sv = state.sceneVideos || {}; const nVid = Object.keys(sv).filter(k => sv[k] && !sv[k].error).length;
  const steps = [
    { nm: 'Profile', done: hasStyle, sb: hasStyle ? 'đã có style' : '—' },
    { nm: 'Kịch bản', done: hasScript, sb: hasScript ? (state.script.length + ' ký tự') : '—' },
    { nm: 'Phân cảnh', done: nScenes > 0, sb: nScenes ? (nScenes + ' cảnh') : '—' },
    { nm: 'Prompt ảnh', done: nScenes > 0 && nPrompts >= nScenes, sb: nScenes ? (nPrompts + '/' + nScenes) : '—' },
    { nm: 'Ảnh cảnh', done: nImg > 0, sb: nImg ? (nImg + ' ảnh') : '—' },
    { nm: 'Video', done: nVid > 0, sb: nVid ? (nVid + ' clip') : '—' },
    { nm: 'Dựng/Xuất', done: false, sb: '—' },
  ];
  let cur = steps.findIndex(s => !s.done); if (cur < 0) cur = steps.length - 1;
  return { steps, cur };
}

// === L?: function renderDashboard ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=32886c, shared=10786c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function renderDashboard(){
  const box = document.getElementById('dashBody'); if (!box) return;
  const name = (document.getElementById('userName')?.textContent || '').trim().replace(/^—$/, '') || 'bạn';
  let dateStr = ''; try { dateStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }); } catch {}
  const s = _dashStats();
  const wf = _dashWorkflow();
  const ic = {
    prof: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    vid: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    scene: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    img: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
    veo: '<path d="M13 2L4.5 13H11l-1 9 8.5-12H12l1-8z"/>',
  };
  const card = (cls, ico, lab, val) => `<div class="dcard"><span class="ico ${cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ico}</svg></span><div><div class="lab">${lab}</div><div class="val">${val}</div></div></div>`;
  const qa = (act, ico, t, d) => `<a onclick="${act}"><span class="qi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ico}</svg></span><div><div class="qt">${t}</div><div class="qd">${d}</div></div></a>`;
  const stepHtml = wf.steps.map((st, i) => `${i ? '<span class="arr"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></span>' : ''}<div class="st ${st.done ? 'done' : (i === wf.cur ? 'cur' : '')}"><div class="dot">${st.done ? '✓' : (i + 1)}</div><div class="nm">${st.nm}</div><div class="sb">${st.sb}</div></div>`).join('');
  const projs = (state.profiles || []).slice(0, 6).map((p, i) => `<div class="dproj"><span class="th">🎬</span><div style="flex:1;min-width:0"><div class="pn">${escapeHtml(p.tenKenh || 'Profile ' + (i + 1))}</div><div class="pd">${(Array.isArray(p.videos) ? p.videos.length : 1)} video · ${escapeHtml(p.ngach || p.visualStyle || '')}</div></div><button class="btn ghost sm" onclick="switchProfile(${i});switchTool('tool1')">Mở</button></div>`).join('') || '<div class="empty-state">Chưa có profile. Bấm "Tạo Profile mới".</div>';

  box.innerHTML = `
    <div><h1 class="dash-hi">Xin chào, ${escapeHtml(name)} 👋</h1><p class="dash-sub">${dateStr ? dateStr[0].toUpperCase() + dateStr.slice(1) + ' · ' : ''}Chúc bạn một ngày làm việc hiệu quả!</p></div>
    <div class="dash-stats">
      ${card('di-green', '<path d="M20 6L9 17l-5-5"/>', 'Video hoàn thành', s.doneTotal)}
      ${card('di-accent', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 'Đang sản xuất', s.producing)}
      ${card('di-blue', '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>', 'Sản xuất tháng này', s.doneMonth)}
      ${card('di-violet', ic.prof, 'Kênh (profile)', s.profiles)}
      ${card('di-teal', ic.vid, 'Tổng video', s.videos)}
    </div>
    <div class="dsec dauto">
      <div class="dsec-h" style="display:flex;align-items:center;justify-content:space-between">
        <span>🚀 Sản xuất video tự động — 1 nút chạy cả quy trình</span>
        <button class="btn ghost sm" onclick="queueAdd()" style="text-transform:none;font-weight:600;letter-spacing:0">＋ Thêm vào hàng đợi</button>
      </div>
      <style>@keyframes autopulse{0%,100%{opacity:1}50%{opacity:.3}}
        .dsh-lbl{font-size:12px;color:var(--text-muted);margin:0 0 6px;display:block}
        .dsh-field{width:100%;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;font-size:13px;color:var(--text);font-family:inherit}
        .dsh-field:focus{outline:none;border-color:var(--accent)}
      </style>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px;font-size:13px;padding:9px 11px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px">
        <span style="color:var(--text-muted);white-space:nowrap">💾 Lưu về máy:</span>
        <select id="dashSaveMode" onchange="dashSaveMode(this.value)" style="max-width:220px;width:auto">
          <option value="perTask" selected>Tạo thư mục theo video</option>
          <option value="flat">Lưu thẳng vào thư mục</option>
        </select>
        <input type="text" id="dashSaveName" placeholder="Tên thư mục (tuỳ chọn)" style="max-width:190px" oninput="_autoSaveName=this.value;try{localStorage.setItem('av_save_name',this.value)}catch(e){}">
        <input type="text" id="dashSaveFolder" readonly placeholder="Chưa chọn thư mục lưu" style="flex:1;min-width:180px">
        <button class="btn ghost sm" onclick="autoPickFolder()">📁 Chọn thư mục</button>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <span>⚡ Tài khoản Flow (tạo ảnh):</span>
        <span id="dashFlowAcc">đang kiểm tra…</span>
        <button class="btn ghost sm" style="margin-left:auto" onclick="switchTool('toolflow')">Thêm / quản lý tài khoản</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:14px;font-size:13px">
        <label style="display:flex;gap:8px;align-items:center">Bắt đầu từ:
          <select id="dashStart" style="width:auto" onchange="dashToggleStart()">
            <option value="script" selected>Kịch bản (làm từ đầu)</option>
            <option value="scenes">Prompt cảnh (đã có kịch bản + giọng)</option>
          </select>
        </label>
      </div>
      <div id="dashTopicRow" style="margin-bottom:14px">
        <label class="dsh-lbl">Chủ đề / Tiêu đề video</label>
        <input id="dashTopic" class="dsh-field" placeholder="VD: Bí ẩn sự sụp đổ của Đế chế La Mã" oninput="_autoTopic=this.value">
        <div id="dashWordsWrap" style="display:flex;align-items:flex-end;gap:12px;margin-top:12px">
          <div>
            <label class="dsh-lbl">Số lượng từ</label>
            <input id="dashWords" class="dsh-field" type="number" min="100" step="100" value="800" oninput="dashWordEst()" style="width:120px">
          </div>
          <span id="dashWordEst" style="font-size:12px;color:var(--text-dim);white-space:nowrap;padding-bottom:11px">≈ 5.3 phút đọc</span>
        </div>
      </div>
      <div id="dashPrepared" style="display:none;margin-bottom:14px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)">
        <label style="display:block;font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px">📄 Kịch bản (file .txt)</label>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
          <input type="file" id="dashScriptFile" accept=".txt,text/plain" onchange="dashLoadScriptFile(this.files)">
          <span id="dashScriptName" style="font-size:12px;color:var(--green)"></span>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-bottom:12px">Để trống = tự lấy kịch bản từ tab Tạo Kịch Bản / Phân Cảnh.</div>
        <label style="display:block;font-size:10.5px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px">🎙 File giọng đọc <span style="text-transform:none">(tuỳ chọn)</span></label>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <input type="file" id="dashVoiceFile" accept="audio/*" onchange="dashPickVoice(this.files)">
          <span id="dashVoiceName" style="font-size:12px;color:var(--green)"></span>
        </div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:6px">Để trống file giọng = video xuất không kèm tiếng (ghép sau ở Dựng Video).</div>
      </div>
      <div style="font-size:11.5px;color:var(--text-dim);margin-bottom:2px">Điền form rồi bấm <b>Chạy hàng đợi</b> (dưới). Luồng tự động chạy tới <b>Dựng video</b> rồi <b>dừng</b> (chưa xuất file) — bạn sang tab <b>Dựng Video</b> kiểm/tạo lại cảnh lỗi rồi tự bấm <b>Xuất</b>. Muốn làm nhiều: bấm <b>Thêm vào hàng đợi</b> từng cái rồi mới Chạy.</div>
      <div id="autoLog" style="font-size:12.5px;color:var(--text-muted);margin-top:6px;min-height:18px"></div>
    </div>
    <div class="dsec">
      <div class="dsec-h" style="display:flex;align-items:center;justify-content:space-between">
        <span>Hàng đợi <span id="queueCount" style="color:var(--text-muted);font-weight:400;font-size:12px;text-transform:none;letter-spacing:0">0 mục</span></span>
        <span style="display:flex;gap:8px">
          <button class="btn primary sm" id="queueRunBtn" onclick="runQueue()" style="text-transform:none;letter-spacing:0">▶ Chạy hàng đợi</button>
          <button class="btn sm" id="queueStopBtn" onclick="queueStop()" style="display:none;background:var(--red);color:#fff;text-transform:none;letter-spacing:0">■ Dừng</button>
        </span>
      </div>
      <div id="queueList"></div>
    </div>
    <details class="dsec" style="margin-top:0">
      <summary style="cursor:pointer;list-style:none;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);display:flex;align-items:center;justify-content:space-between">
        <span>🕘 Lịch sử chạy</span>
        <span onclick="event.preventDefault();_histClear()" style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-dim);cursor:pointer">Xoá lịch sử</span>
      </summary>
      <div id="histList" style="margin-top:10px"></div>
    </details>`;
  try {
    _histRender();
    _dashFlowStatus();
    _autoRender();
    const tt = document.getElementById('dashTopic'); if (tt && _autoTopic) tt.value = _autoTopic;
    const sm = document.getElementById('dashSaveMode'); if (sm) sm.value = _autoSaveMode;
    const snm = document.getElementById('dashSaveName'); if (snm) snm.value = _autoSaveName || '';
    dashSaveMode(_autoSaveMode);
    const sf = document.getElementById('dashSaveFolder'); if (sf) { const base = _autoOutDir || _autoDefaultDir; if (base) sf.value = base; }
    const ss = document.getElementById('dashStart'); if (ss) ss.value = _autoStartFrom;
    dashToggleStart();
    const vn = document.getElementById('dashVoiceName'); if (vn && _autoVoiceFile) vn.textContent = '✓ ' + _autoVoiceFile.name;
    if (_autoLastLog) _autoLog(_autoLastLog.msg, _autoLastLog.type);
    queueRender();
    if (_queueRunning) { const r = document.getElementById('queueRunBtn'), st = document.getElementById('queueStopBtn'); if (r) r.style.display = 'none'; if (st) st.style.display = ''; }
  } catch (e) {}
}

// === L?: const PROD_STEPS ===
const PROD_STEPS = [
  { key: 'script', label: 'Kịch bản',        tool: 'toolscript', res: 'cli' },
  { key: 'voice',  label: 'Giọng đọc',       tool: 'toolvoice',  res: 'voice' },
  { key: 'scenes', label: 'Prompt cảnh',     tool: 'tool2',      res: 'cli' },
  { key: 'assets', label: 'Prompt nhân vật', tool: 'tool3',      res: 'cli' },
  { key: 'seo',    label: 'YouTube SEO',     tool: 'tool9',      res: 'cli' },
  { key: 'images', label: 'Tạo ảnh',         tool: 'toolflow',   res: 'flow' },
  { key: 'videos', label: 'Xen video',       tool: 'tool6',      res: 'local' },
  { key: 'thumb',  label: 'Thumbnail',       tool: 'tool9',      res: 'flow' },
  { key: 'build',  label: 'Dựng video',      tool: 'tool7',      res: 'local' },
  // ⛔ Bỏ bước 'Xuất file' khỏi luồng tự động: dừng sau khi ráp timeline để user kiểm & tạo lại cảnh lỗi,
  //    rồi tự bấm Xuất ở tab Dựng Video. (Handler export bên dưới giữ lại, chỉ không nằm trong quy trình auto.)
];

// === L?: let _autoBusy, _autoAbort, _autoState, _autoOutDir, _autoTopic ===
let _autoBusy = false, _autoAbort = false, _autoState = {}, _autoOutDir = '', _autoTopic = '';

// === L?: let _autoVoiceFile, _autoStartFrom, _autoDefaultDir, _autoScriptText ===
let _autoVoiceFile = null, _autoStartFrom = 'script', _autoDefaultDir = '', _autoScriptText = '';

// === L?: let _autoSaveMode, _autoSaveName ===
let _autoSaveMode = 'perTask', _autoSaveName = '';

// === L?: function dashToggleStart ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=602c, shared=492c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function dashToggleStart(){
  const sel = document.getElementById('dashStart'); const v = sel ? sel.value : 'script';
  _autoStartFrom = v;
  const box = document.getElementById('dashPrepared'); if (box) box.style.display = v === 'scenes' ? 'block' : 'none';
  // Khối Chủ đề + số từ chỉ hiện khi làm từ đầu; từ Prompt cảnh → ẩn cả khối (tiêu đề suy từ kịch bản/SEO).
  const trow = document.getElementById('dashTopicRow'); if (trow) trow.style.display = v === 'scenes' ? 'none' : '';
}

// === L?: function dashWordEst ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=578c, shared=235c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function dashWordEst(){
  const w = parseInt(document.getElementById('dashWords')?.value) || 0;
  const el = document.getElementById('dashWordEst');
  if (el) el.textContent = w ? ('≈ ' + (w / 150).toFixed(1) + ' phút đọc') : '';
}

// === L?: let _autoLastLog ===
let _autoLastLog = null;

// === L?: let _prodQueue, _queueRunning, _queueAbort, _queueCurId, _queueVoice, _flowExhausted ===
let _prodQueue = [], _queueRunning = false, _queueAbort = false, _queueCurId = null, _queueVoice = {}, _flowExhausted = false;

// === L?: const _STEP_TO ===
const _STEP_TO = { cli: 45 * 60000, voice: 30 * 60000, flow: 60 * 60000, local: 40 * 60000 };

// === L?: let _autoRetryTimer ===
let _autoRetryTimer = null;

// === L?: const _RETRY_MIN ===
const _RETRY_MIN = 30;

// === L?: const _T2_FIELDS ===
const _T2_FIELDS = { splitMode: 'v', t2DescMode: 'v', minChars: 'v', maxChars: 'v', minSecPerImg: 'v', maxSecPerImg: 'v', batchSize: 'v', shortPromptMode: 'c', highDetailMode: 'c', brollMode: 'c', noCharMode: 'c', hybridIconMode: 'c' };

// === L?: const _VOICE_FIELDS ===
const _VOICE_FIELDS = { voiceLang: 'v', voiceSpeed: 'v', voiceGap: 'v', voiceInstruct: 'v' };

// === L?: function applyChannelCfg ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=791c, shared=567c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function applyChannelCfg(p){
  p = p || ((typeof getProfile === 'function') ? getProfile() : null); if (!p) return;
  _appCfg(_T2_FIELDS, p.t2Cfg);
  if (p.voiceCfg){
    _appCfg(_VOICE_FIELDS, p.voiceCfg);
    if (p.voiceCfg.voiceMode){ const r = document.querySelector('input[name="voiceMode"][value="' + p.voiceCfg.voiceMode + '"]'); if (r) r.checked = true; }
    if ('preset' in p.voiceCfg){ try { _voicePreset = p.voiceCfg.preset || ''; } catch (e) {} const vs = document.getElementById('voiceSaved'); if (vs) vs.value = p.voiceCfg.preset || ''; }
  }
}

// === L?: function queueAdd ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-queue.js (peer=3200c, shared=3156c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function queueAdd(){
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  if (!p) return _autoLog('Chưa có Profile — tạo/chọn Profile trước.', 'error');
  // Giới hạn hàng đợi tự động theo gói
  if (!canAutoRun()) return showGate('Dashboard tự động (1 nút) & hàng đợi chỉ dành cho gói Sáng tạo trở lên. Nâng cấp để tự động hoá sản xuất.', { upgrade: true });
  const qlim = getMaxQueue();
  if (qlim !== Infinity && _prodQueue.length >= qlim) {
    return showGate(`Gói ${tierPlanName(state.userTier)} chỉ xếp được ${qlim} video trong hàng đợi. Nâng cấp lên Studio để chạy không giới hạn.`, { upgrade: true });
  }
  const startFrom = document.getElementById('dashStart')?.value || 'script';
  const topic = (document.getElementById('dashTopic')?.value || '').trim();
  let script = (_autoScriptText || '').trim();
  const words = parseInt(document.getElementById('dashWords')?.value) || 800;
  if (startFrom === 'script') { if (!topic) return _autoLog('Nhập chủ đề video trước khi thêm.', 'error'); }
  else { if (!script) script = (state.script || document.getElementById('tsOutput')?.value || '').trim(); if (!script) return _autoLog('Chưa có kịch bản — chọn file .txt, hoặc viết ở tab Tạo Kịch Bản.', 'error'); }
  const title = topic || ('Video ' + (_prodQueue.length + 1) + ' — chờ SEO đặt tên');
  const id = _qid();
  captureChannelCfg();   // lưu cấu hình Tool 2 + giọng hiện tại vào kênh này
  const pname = (p.tenKenh || '').trim() || ('Profile ' + (state.currentProfileIdx + 1));
  const job = {
    id, title, topic, startFrom, script: startFrom === 'scenes' ? script : '', words,
    profileIdx: state.currentProfileIdx, profileName: pname, status: 'queued', detail: 'chờ tới lượt',
    // Ghi nhớ nơi lưu RIÊNG cho video này (theo cài đặt lúc bấm Thêm)
    saveMode: _autoSaveMode, saveName: (_autoSaveName || '').trim(), saveDir: (_autoOutDir || _autoDefaultDir || ''),
  };
  if (startFrom === 'scenes' && _autoVoiceFile) { _queueVoice[id] = _autoVoiceFile; job.voiceName = _autoVoiceFile.name; }
  // Ghi mức xen video 🎞/🎬 LÚC bấm Thêm → pipeline dùng ĐÚNG lựa chọn của kênh (không bị newVideo đưa về mặc định).
  { const b = state.nguonBat || {};
    job.nguonBat = Object.assign({}, b);
    job.webBat = Object.assign({}, state.webBat || {});
    job.videoMix = b.veo ? 6 : 0; job.stockMix = b.stock ? 6 : 0; job.ytMix = b.yt ? 6 : 0;
  }
  if (job.script) { try { IDB.set('qs_' + id, job.script); } catch (e) {} }   // kịch bản → IndexedDB (giữ localStorage nhẹ)
  _prodQueue.push(job); queueSave(); queueRender();
  // Xoá form soạn để thêm cái kế
  const tt = document.getElementById('dashTopic'); if (tt) tt.value = ''; _autoTopic = '';
  _autoScriptText = ''; const sn = document.getElementById('dashScriptName'); if (sn) sn.textContent = '';
  const sf = document.getElementById('dashScriptFile'); if (sf) sf.value = '';
  _autoVoiceFile = null; const vn = document.getElementById('dashVoiceName'); if (vn) vn.textContent = '';
  const vf = document.getElementById('dashVoiceFile'); if (vf) vf.value = '';
  _autoLog('✓ Đã thêm "' + title + '" vào hàng đợi.', 'ok');
}

async function _runPipeline(job){
  const topic = job.topic || ''; const startFrom = job.startFrom || 'script';
  const resuming = !!job.videoId;   // đã có video → đang làm tiếp (chỉ bù bước/ảnh còn thiếu)

  // Đúng profile của job
  if (typeof job.profileIdx === 'number' && job.profileIdx >= 0 && job.profileIdx !== state.currentProfileIdx && typeof switchProfile === 'function') {
    try { await switchProfile(job.profileIdx); } catch (e) {}
  }
  try { applyChannelCfg(getProfile()); } catch (e) {}   // dùng cấu hình Tool 2 + giọng RIÊNG của kênh này
  if (!resuming) {
    try { await newVideo(); } catch (e) {}   // lần đầu: video trắng riêng
    const nv = (typeof getCurrentVideo === 'function') ? getCurrentVideo(getProfile()) : null;
    if (nv) { job.videoId = nv.id; if (job.title) nv.name = job.title; }
    job.step = 0;
    PROD_STEPS.forEach(s => _autoState[s.key] = { status: 'idle' });
  } else {
    try { if (typeof switchVideo === 'function') await switchVideo(job.videoId); } catch (e) {}   // nạp lại video đã làm dở
    PROD_STEPS.forEach((s, idx) => _autoState[s.key] = { status: idx < (job.step || 0) ? 'done' : 'idle' });
  }
  _autoRender();
  const getVid = () => { const p = getProfile(); return (typeof getCurrentVideo === 'function') ? getCurrentVideo(p) : null; };

  const RUN = {
    script: async () => {
      if (startFrom === 'scenes') {
        let scr = (job.script || '').trim();
        if (!scr) { try { scr = ((await IDB.get('qs_' + job.id)) || '').trim(); } catch (e) {} if (scr) job.script = scr; }   // nạp lại từ IndexedDB sau khi khởi động lại
        scr = scr || state.script || '';
        if (!scr) throw new Error('Chưa có kịch bản.');
        state.script = scr; const si = document.getElementById('scriptInput'); if (si) si.value = scr; return { sub: scr.length + ' ký tự (có sẵn)' };
      }
      const tt = document.getElementById('tsTopic'); if (tt) tt.value = topic;
      const tw = document.getElementById('tsWords'); if (tw && job.words) tw.value = job.words;
      await tsGenerate(false);
      const scr = (document.getElementById('tsOutput')?.value || '').trim();
      if (!scr) throw new Error('AI chưa tạo được kịch bản (kiểm tra AI provider / CLI bridge).');
      const si = document.getElementById('scriptInput'); if (si) si.value = scr; state.script = scr;
      return { sub: scr.length + ' ký tự' };
    },
    voice: async () => {
      if (startFrom === 'scenes') { const vf = _queueVoice[job.id]; if (vf) { t7State.audioFile = vf; return { sub: 'file có sẵn' }; } return { skip: true, sub: 'bỏ qua' }; }
      // Gọi thẳng engine. Trước đây bước này bấm nút rồi CÀO thẻ <audio> trong
      // DOM — backend chết là cả job chết. Giờ ttsDoc() tự lui về engine còn sống.
      if (!_giongDS.length) await giongTaiDS();
      const vt = document.getElementById('voiceText'); if (vt){ vt.value = state.script; giongDemChu(); }
      const { blob, giong, luiVe } = await ttsDoc(state.script, null);
      const mp3 = /(mpeg|mp3)/.test(blob.type);
      await t7HandleAudio(new File([blob], 'voice' + (mp3 ? '.mp3' : '.wav'), { type: blob.type || 'audio/wav' }));
      return { sub: giong.name + (luiVe ? ' (lui về ' + _TTS_TEN[giong.engine] + ')' : '') };
    },
    scenes: async () => {
      const si = document.getElementById('scriptInput'); if (si) si.value = state.script;
      // Áp mức xen video 🎞/🎬 mà kênh đã chọn (ghi lúc Thêm) — vì newVideo() vừa đưa DOM về mặc định.
      if (job.videoMix != null){ state.videoMix = job.videoMix; const e = document.getElementById('t2VideoMix'); if (e) e.value = String(job.videoMix); }
      if (job.stockMix != null){ state.stockMix = job.stockMix; const e = document.getElementById('t2StockMix'); if (e) e.value = String(job.stockMix); }
      if (job.ytMix != null){ state.ytMix = job.ytMix; const e = document.getElementById('t2YtMix'); if (e) e.value = String(job.ytMix); }
      if (job.nguonBat){ state.nguonBat = Object.assign({ veo:false, stock:false, yt:false, kho:false, web:false }, job.nguonBat); try { t2RenderNguon(); } catch (e) {} }
      if (job.webBat && Object.keys(job.webBat).length) state.webBat = Object.assign({}, job.webBat);
      // Đưa file giọng vào Tool 2 để TỰ CĂN TIMING (Whisper) — thời lượng cảnh khớp giọng đọc. Không có giọng → dùng độ dài ước lượng.
      try { _autoAudioFile = (t7State && t7State.audioFile) || null; _autoAudioWords = null; } catch (e) {}
      const chk = document.getElementById('autoFlowImages'); const prev = chk ? chk.checked : false; if (chk) chk.checked = false;
      try { await runAutoTool2(); } finally { if (chk) chk.checked = prev; }
      const n = (state.scenes || []).length; if (!n) throw new Error('Chưa chia được cảnh.'); return { sub: n + ' cảnh' + (t7State.audioFile ? ' (căn theo giọng)' : '') };
    },
    assets: async () => { await runAutoTool3(); return { sub: ((state.charactersV || []).length + (state.backgroundsV || []).length) + ' asset' }; },
    seo: async () => {
      if (typeof t9Init === 'function') t9Init();
      const ti = document.getElementById('t9Title'); if (ti) ti.value = topic || '';
      await t9Generate(); if (!t9State.result) throw new Error('SEO chưa tạo được.');
      const seoTitle = (t9State.result.titles && t9State.result.titles[0]) || ''; const finalTitle = topic || seoTitle;
      if (finalTitle && finalTitle !== job.title) { job.title = finalTitle; const v = getVid(); if (v) v.name = finalTitle; queueRender(); }
      return { sub: 'xong' };
    },
    images: async () => {
      // Tự lưu ảnh về máy vào thư mục của video này (đặt tên theo cảnh/nhân vật). Giữ lại cấu hình cũ của tab Flow.
      const prevAsv = state.autoSave;
      const idir = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
      state.autoSave = { enabled: !!idir, mode: 'perTask', folder: idir, taskName: _slug(job.title) };
      let n = 0, quota = '';
      try {
        for (const r of [await tfGenAssets('char', resuming), await tfGenAssets('bg', resuming), await tfGenScenes(resuming)]) {
          if (r && r.skipped) { if (_isQuotaErr(r.reason)) return { quota: true, reason: r.reason }; throw new Error(r.reason || 'Flow chưa sẵn sàng'); }
          n += (r && r.done) || 0;
          if (r && r.err > 0 && _isQuotaErr(r.lastErr || r.error || '')) quota = r.lastErr || r.error;
        }
      } finally { state.autoSave = prevAsv; }
      if (quota) return { quota: true, reason: quota, sub: n + ' ảnh (còn thiếu)' };
      return { sub: n + ' ảnh' };
    },
    videos: async () => {
      // Xen video cho cảnh đánh dấu: 🎞 stock (free) + 🎬 Veo (best-effort) + ▶️ clip YouTube. Không cảnh nào đánh dấu → bỏ qua.
      const scenes = state.scenes || [];
      const wantStock = scenes.filter(s => s.wantStock || s.wantKho);   // kho mở đi chung đường lấy stock
      const wantVideo = scenes.filter(s => s.wantVideo);
      const wantYtAll = scenes.filter(s => s.wantYt);
      const wantWebAll = scenes.filter(s => s.wantWeb);
      if (!wantStock.length && !wantVideo.length && !wantYtAll.length && !wantWebAll.length) return { skip: true, sub: 'không có cảnh xen video' };
      const parts = [];
      // 1) STOCK 🎞 — free, ổn định (Pexels/Pixabay)
      if (wantStock.length){
        if (typeof getPexelsKey === 'function' && (getPexelsKey() || getPixabayKey())){
          try { await t2FetchStockVideos(); const got = wantStock.filter(s => state.mediaPicks?.[s.id]).length; parts.push(`${got}/${wantStock.length} stock`); }
          catch (e){ parts.push('stock lỗi'); }
        } else parts.push('stock: thiếu API key (Cài đặt)');
      }
      // 2) VEO 🎬 — best-effort, tốn quota Flow; bỏ qua nếu hết quota / gói không mở tool6 / lỗi (KHÔNG làm dừng pipeline)
      if (wantVideo.length && typeof isToolAllowed === 'function' && isToolAllowed('tool6') && !_flowExhausted){
        try {
          mvLoadScenes();
          const ids = new Set(wantVideo.map(s => s.id));
          mvScenes = mvScenes.filter(s => ids.has(s.origId || s.id) && s.img && s.img.base64 && s.variant !== 'b');
          if (mvScenes.length){
            await mvGenerate();                              // sinh motion prompt cho cảnh 🎬
            if (!_autoAbort) await mvVideoGenerate();        // tạo video Veo (lỗi/quota tự ghi per-cảnh, không throw)
            const got = wantVideo.filter(s => mvVideoBlobs[s.id]).length;
            parts.push(`${got}/${wantVideo.length} Veo`);
          }
        } catch (e){ parts.push('Veo bỏ qua (' + (e.message || 'lỗi') + ')'); }
        finally { try { mvLoadScenes(); } catch (e){} }      // khôi phục danh sách cảnh đầy đủ
      } else if (wantVideo.length){
        parts.push('Veo bỏ qua (hết quota / gói chưa mở)');
      }
      // 3) YOUTUBE ▶️ — cắt clip thật đúng thời lượng cảnh (yt-dlp + FFmpeg trên máy). Bỏ cảnh đã có stock; lỗi KHÔNG làm dừng pipeline.
      const wantYt = wantYtAll.filter(s => !(state.mediaPicks || {})[s.id]);
      if (wantYt.length && !_autoAbort){
        const ry = await _autoFetchYtClips(wantYt);
        parts.push(`${ry.ok}/${wantYt.length} YouTube${ry.stop ? ' (dừng: ' + ry.stop + ')' : ''}`);
      }
      // 4) NGUỒN WEB 🌐 — 55 nền tảng; tìm rồi cắt đúng giây cảnh bằng yt-dlp.
      const wantWeb = wantWebAll.filter(s => !(state.mediaPicks || {})[s.id]);
      if (wantWeb.length && !_autoAbort){
        const rw = await _autoFetchWebClips(wantWeb);
        parts.push(`${rw.ok}/${wantWeb.length} web${rw.stop ? ' (dừng: ' + rw.stop + ')' : ''}`);
      }
      // 5) CỨU cảnh vẫn trống — trả về ảnh AI + sinh prompt bù, không để cảnh đen.
      if (!_autoAbort){
        try { const rc = await _t2CuuCanhTrong(true); if (rc.cuu) parts.push(`${rc.cuu} cảnh về ảnh AI`); }
        catch (e){ /* cứu hỏng thì thôi, đừng chặn pipeline */ }
      }
      return { sub: parts.join(', ') || 'xong' };
    },
    thumb: async () => {
      const ti = document.getElementById('t10TitleInput'); const title = topic || job.title || (t9State.result?.titles?.[0] || '');
      if (ti) ti.value = title; await t10Generate();
      if (!(t10State.results || []).length) throw new Error('Thumbnail chưa tạo được (Flow?).');
      // Lưu thumbnail: bản nhỏ vào workData (xem lại trong app) + file đầy đủ ra thư mục video.
      try {
        const first = t10State.results[0];
        if (first && first.dataUrl) {
          const v = getVid(); if (v) { if (!v.workData) v.workData = createEmptyWorkData(); v.workData.thumbUrl = await _shrinkDataUrl(first.dataUrl, 360, 0.72); }
          const idir = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
          if (idir && window.native?.saveFile) { try { await window.native.saveFile({ dir: idir, subdir: _slug(job.title), name: 'thumbnail.png', base64: first.dataUrl }); } catch (e) {} }
        }
      } catch (e) {}
      return { sub: t10State.results.length + ' ảnh' };
    },
    build: async () => { t7Build(); const n = (t7State.clips || []).length; if (!n) throw new Error('Không có cảnh để dựng.'); return { sub: n + ' clip' }; },
    export: async () => {
      if (!(window.native && typeof window.native.renderVideo === 'function')) return { skip: true, sub: 'chỉ desktop' };
      // Nơi lưu RIÊNG của video này (đã ghi lúc thêm); fallback về cài đặt chung nếu job cũ.
      let base = (job.saveDir != null ? job.saveDir : (_autoOutDir || _autoDefaultDir)) || '';
      const wrap = ((job.saveName != null ? job.saveName : _autoSaveName) || '').trim();
      const mode = job.saveMode || _autoSaveMode || 'perTask';
      if (wrap) base = base ? (base + '/' + _slug(wrap)) : _slug(wrap);
      const nf = _slug(job.title);
      const finalDir = (mode === 'flat') ? base : (base ? (base + '/' + nf) : nf);
      const d = document.getElementById('t7ExpDir'); if (d) d.value = finalDir;
      const nm = document.getElementById('t7ExpName'); if (nm) nm.value = nf;
      await t7DoExport();
      try { const v = getVid(); if (v) { if (!v.workData) v.workData = createEmptyWorkData(); v.workData.exportPath = (finalDir ? finalDir + '/' : '') + nf + '.mp4'; } } catch (e) {}   // nhớ nơi file xuất
      return { sub: (mode === 'flat') ? 'đã xuất' : ('→ ' + nf) };
    },
  };

  for (let i = job.step || 0; i < PROD_STEPS.length; i++) {
    const s = PROD_STEPS[i];
    if (_autoAbort) throw new Error('Đã dừng theo yêu cầu.');
    // Flow đã hết quota trong phiên này → tạm dừng ngay tại bước Flow, không gọi phí thêm.
    if (s.res === 'flow' && _flowExhausted) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(false); const e = new Error('Hết giới hạn Flow'); e.flowQuota = true; throw e; }
    _autoSet(s.key, 'run', 'đang chạy…');
    let res;
    try {
      res = await Promise.race([
        RUN[s.key](),
        new Promise((_, rej) => setTimeout(() => { const e = new Error('Quá giờ (' + Math.round(_stepTO(s.res) / 60000) + ' phút) ở bước ' + s.label); e.timeout = true; rej(e); }, _stepTO(s.res))),
      ]);
    } catch (e) {
      if (e.timeout) { try { if (typeof stopAutoTool2 === 'function') stopAutoTool2(); if (typeof tfStop === 'function') tfStop(); if (typeof requestCancel === 'function') requestCancel(); } catch (_) {} }
      if (s.res === 'flow' && _isQuotaErr(e.message)) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(true); const q = new Error(e.message); q.flowQuota = true; throw q; }
      _autoSet(s.key, 'error', (e.message || 'lỗi').slice(0, 32)); await _persistJob(s.res === 'flow'); throw e;
    }
    if (res && res.quota) { _autoSet(s.key, 'run', 'chờ Flow (hết quota)'); await _persistJob(true); const q = new Error(res.reason || 'Hết giới hạn Flow'); q.flowQuota = true; throw q; }
    if (res && res.skip) { _autoSet(s.key, 'skip', res.sub || 'bỏ qua'); }
    else { _autoSet(s.key, 'done', (res && res.sub) || 'xong'); }
    job.step = i + 1; await _persistJob(s.res === 'flow'); queueRender();
  }
}

// === L?: const _QRUN ===
const _QRUN = ['queued', 'running', 'paused'];

// === L?: const PROVIDER_LABEL ===
const PROVIDER_LABEL = { anthropic: 'Claude', openai: 'OpenAI', deepseek: 'DeepSeek' };

async function testApi(){
  const provider = document.getElementById('apiProvider').value;
  const sel = document.getElementById('apiModel');
  const customInput = document.getElementById('apiModelCustom');
  let model = sel.value;
  // Nếu chọn custom, lấy model thật từ ô tuỳ chỉnh (tránh gửi nhầm "custom")
  if (model === 'custom') model = customInput ? customInput.value.trim() : '';
  // CLI tự host: không cần API key, test qua endpoint bridge.
  if (provider === 'cli') {
    const ep = _cliEp();
    if (!ep) return setApiStatus('Chưa nhập Endpoint CLI.', 'err');
    setApiStatus('Đang test CLI...', 'info');
    try {
      const reply = await callLLM('Trả lời ngắn: "ok"', { maxTokens: 30, _override: { provider, model, cliEndpoint: ep } });
      if (reply && reply.toLowerCase().includes('ok')) setApiStatus('✓ CLI hoạt động: ' + reply.trim().slice(0, 30), 'ok');
      else setApiStatus('? Phản hồi lạ: ' + (reply || '').slice(0, 40), 'info');
    } catch (e) { setApiStatus('✗ Lỗi: ' + (e.message || '').slice(0, 90), 'err'); }
    return;
  }
  const key = collectKeys()[0];
  if (!key) return setApiStatus('Thiếu API key', 'err');

  setApiStatus('Đang test...', 'info');
  try {
    const reply = await callLLM('Trả lời ngắn: "ok"', { maxTokens: 30, _override: { provider, model, key } });
    if (reply && reply.toLowerCase().includes('ok')) {
      setApiStatus('✓ API hoạt động: ' + reply.trim().slice(0, 30), 'ok');
    } else {
      setApiStatus('? Phản hồi lạ: ' + (reply || '').slice(0, 40), 'info');
    }
  } catch (e) {
    console.error('[AI Test] lỗi ĐẦY ĐỦ:', e.message);   // xem nguyên văn ở DevTools Console
    setApiStatus('✗ Lỗi: ' + e.message.slice(0, 400), 'err');
  }
}

// === L?: let _apiKeyIdx ===
let _apiKeyIdx = 0;

// === L?: const LLM_TIMEOUT_MS ===
const LLM_TIMEOUT_MS = 180000;

// === L?: const LLM_MAX_RETRY ===
const LLM_MAX_RETRY  = 4;

async function _withRetry(fn){
  const MAX = LLM_MAX_RETRY;   // tổng số lần thử
  let delay = 800;            // ms, nhân dần (có trần)
  for (let attempt = 1; ; attempt++){
    try { return await fn(); }
    catch (e) {
      const msg = String(e?.message || e);
      const retryable = /failed to fetch|load failed|networkerror|network error|không kết nối được|quá thời gian/i.test(msg)
        || /\bAPI (409|429|5\d\d)\b/.test(msg);   // 409 trùng request (gateway dedupe), 429 quá tải + 5xx (502/503/504) đều thử lại
      if (!retryable || attempt >= MAX) throw e;
      try { if (typeof novaLog === 'function') novaLog(`  ↻ AI lỗi tạm (${msg.slice(0, 40)}) — thử lại lần ${attempt + 1}/${MAX}…`, 'warn'); } catch(_){}
      const isDup = /\bAPI 409\b/.test(msg);   // request trùng đang được server xử lý → đợi LÂU hơn cho request gốc xong
      // 409 duplicate: request gốc (model reasoning) có thể còn xử lý 2-3 phút → chờ tăng dần 15/30/60s.
      // Trước đây chỉ chờ ~12s mỗi lần → cả 4 lần thử đều dính 409 và lỗi lộ thẳng ra UI.
      const wait = isDup ? [15000, 30000, 60000, 60000][Math.min(attempt - 1, 3)] : Math.min(delay + Math.random() * 400, 10000);
      await new Promise(r => setTimeout(r, wait));   // 409: chờ cửa sổ dedup của server khép; còn lại trần 10s giữa các lần
      delay *= 2;
    }
  }
}

async function callLLM(prompt, opts = {}){
  const provider = opts._override?.provider || localStorage.getItem('api_provider') || 'anthropic';
  const model = opts._override?.model || localStorage.getItem('api_model') || MODELS[provider][0].id;
  // Mỗi lần gọi lấy 1 key kế tiếp trong pool → nhiều key sẽ tự chia tải khi chạy song song
  const key = opts._override?.key || _nextApiKey();
  const maxTokens = opts.maxTokens || 1500;
  const messages = opts.messages || [{ role: 'user', content: prompt }];

  // CLI tự host: dùng endpoint bridge của user (gói Claude/ChatGPT của họ), KHÔNG cần API key.
  if (provider === 'cli') {
    // App tự chạy bridge ở localhost:8795 → mặc định endpoint đó nếu chưa lưu (đọc cả ô input).
    const ep = (opts._override?.cliEndpoint
      || localStorage.getItem('api_cli_endpoint')
      || (typeof document !== 'undefined' && document.getElementById('cliEndpoint')?.value)
      || 'http://localhost:8795').trim().replace(/\/+$/, '');
    const cliKey = localStorage.getItem('api_cli_key') || '';
    const url = /\/v1\/chat\/completions$/.test(ep) ? ep : ep + '/v1/chat/completions';
    return _withRetry(() => callOpenAICompat(messages, model || 'default', cliKey, maxTokens, url, { json: false, timeoutMs: 600000 }));   // CLI: bỏ json_object (treo với ARRAY); timeout 10 phút vì CLI KHÔNG cap output → sinh dài + chậm, 240s giết oan call sắp xong
  }

  // Không có API key → tự dùng gói Claude/ChatGPT qua bridge nội bộ app luôn chạy (localhost:8795/8796),
  // đúng tinh thần "không cần API key". Nhờ vậy các tính năng (phân tích kịch bản…) chạy ngay.
  if (!key) {
    const ep = (localStorage.getItem('api_cli_endpoint')
      || (typeof document !== 'undefined' && document.getElementById('cliEndpoint')?.value)
      || 'http://localhost:8795').trim().replace(/\/+$/, '');
    const url = /\/v1\/chat\/completions$/.test(ep) ? ep : ep + '/v1/chat/completions';
    const cliModel = /opus/i.test(model) ? 'opus' : /sonnet/i.test(model) ? 'sonnet'
      : (['opus', 'sonnet', 'chatgpt', 'default'].includes(model) ? model : 'default');
    return _withRetry(() => callOpenAICompat(messages, cliModel, '', maxTokens, url, { json: false, timeoutMs: 600000 }));   // CLI: bỏ json_object (treo với ARRAY); timeout 10 phút vì CLI KHÔNG cap output → sinh dài + chậm, 240s giết oan call sắp xong
  }

  // Tác vụ có ảnh nhưng provider không hỗ trợ vision (DeepSeek) → báo lỗi rõ ràng
  const hasImage = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'image'));
  if (hasImage && !VISION_PROVIDERS.includes(provider)) {
    throw new Error(`${provider} không đọc được ảnh. Đổi sang Anthropic/OpenAI cho tác vụ phân tích ảnh.`);
  }

  const thinking = opts._override?.thinking ?? (localStorage.getItem('api_thinking') === '1');
  const json = !!opts.json;   // ép JSON mode (OpenAI/DeepSeek)
  const _baseUrl = (localStorage.getItem('api_base_url') || '').trim().replace(/\/+$/, '');   // gateway ngoài (hhtech/gwai…)
  const doCall = () => {
    if (provider === 'anthropic') return callAnthropic(messages, model, key, maxTokens);   // callAnthropic tự đọc Base URL bên trong
    // Có Base URL → OpenAI/DeepSeek đi QUA gateway (/v1/chat/completions), KHÔNG gọi thẳng api.openai.com/deepseek.
    // stream:true giữ connection qua giai đoạn model reasoning nghĩ (né 500 → retry → 409 duplicate của gateway).
    if (_baseUrl && (provider === 'openai' || provider === 'deepseek'))
      return callOpenAICompat(messages, model, key, maxTokens, _chatEndpoint(_baseUrl), { thinking, json, stream: true });
    if (provider === 'openai')    return callOpenAI(messages, model, key, maxTokens, { json });
    if (provider === 'gemini')    return callOpenAICompat(messages, model, key, maxTokens, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', { json, stream: true });
    if (provider === 'deepseek')  return callOpenAICompat(messages, model, key, maxTokens, 'https://api.deepseek.com/v1/chat/completions', { thinking, json, stream: true });
    // Các provider OpenAI-compatible
    const BASE_URLS = {
      openrouter:  'https://openrouter.ai/api/v1',
      groq:        'https://api.groq.com/openai/v1',
      mistral:     'https://api.mistral.ai/v1',
      cohere:      'https://api.cohere.ai/v1',
      perplexity:  'https://api.perplexity.ai',
      together:    'https://api.together.xyz/v1',
      fireworks:   'https://api.fireworks.ai/inference/v1'
    };
    if (provider in BASE_URLS) {
      const base = _baseUrl || BASE_URLS[provider];
      return callOpenAICompat(messages, model, key, maxTokens, _chatEndpoint(base), { thinking, json, stream: true });
    }
    // OpenAI Compatible Custom: bắt buộc phải có Base URL
    if (provider === 'openai-compatible') {
      if (!_baseUrl) throw new Error('Vui lòng nhập Base URL cho OpenAI Compatible.');
      return callOpenAICompat(messages, model, key, maxTokens, _chatEndpoint(_baseUrl), { thinking, json, stream: true });
    }
    throw new Error('Provider không hỗ trợ: ' + provider);
  };
  return _withRetry(doCall);
}

// === L?: const LLM_PRICE ===
const LLM_PRICE = {
  'gpt-5':          [1.25, 0.125, 10],
  'gpt-5-mini':     [0.25, 0.025, 2],
  'gpt-5-nano':     [0.05, 0.005, 0.40],
  'gpt-5.6-sol':    [5,    5,     30],
  'gpt-5.6-terra':  [2.5,  2.5,   15],
  'gpt-5.6-luna':   [1,    1,     6],
  'gemini-2.5-flash-lite': [0.10, 0.01, 0.40],
  'gemini-2.5-flash':      [0.30, 0.03, 2.50],
  'gemini-2.5-pro':        [1.25, 0.125, 10],
};

// === L?: let _llmUse ===
let _llmUse = { calls: 0, inTok: 0, cacheTok: 0, outTok: 0, usd: 0, steps: {} };

// === L?: let _llmStep ===
let _llmStep = 'khác';

// === L?: const _k ===
const _k = n => (n / 1000).toFixed(1) + 'k';

// === L?: let _novaLog ===
let _novaLog = [];

// === L?: function novaLog ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=276c, shared=268c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function novaLog(msg, type){
  let t = ''; try { t = new Date().toLocaleTimeString('vi-VN'); } catch(e){}
  _novaLog.push({ t, msg: String(msg), type: type || '' });
  if (_novaLog.length > 800) _novaLog.shift();
  if (state.tool === 'toollog') novaLogRender();
}

// === L?: let __epInited ===
let __epInited = false;

// === L?: function switchTool ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=6216c, shared=3075c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function switchTool(name){
  if (name === 'toollog') { setTimeout(novaLogRender, 0); }
  if (name === 'tooladmin') {
    if (!isAdmin()) return;   // tab admin: chỉ admin
  } else if (name === 'toolsettings') {
    /* trang Cài đặt: luôn cho vào */
  }
  // Free XEM được mọi tool (không chặn ở đây); chặn ở NÚT hành động trong từng tool → hiện thông báo.
  state.tool = name;
  document.querySelectorAll('.nav-item').forEach(t =>
    t.classList.toggle('active', t.dataset.tool === name)
  );
  document.querySelectorAll('.tool').forEach(t =>
    t.classList.toggle('active', t.id === 'tool-' + name)
  );
  // Tool-specific init
  if (name === 'tool2' && typeof renderSceneTypeToggles === 'function') { renderSceneTypeToggles(); if (typeof t2UpdateAnalyzeBtn === 'function') t2UpdateAnalyzeBtn(); }
  if (name === 'tooldash' && typeof renderDashboard === 'function') renderDashboard();
  if (name === 'tool6'){ if (typeof _autoSaveSyncUI === 'function') _autoSaveSyncUI(); if (typeof tvFlowStatus === 'function') tvFlowStatus(); if (typeof tvLoadModelKeys === 'function') tvLoadModelKeys(); if (typeof tvOnModelChange === 'function') tvOnModelChange(); if (typeof tvSetMode === 'function') tvSetMode(document.getElementById('tvMode')?.value || 'scene'); if (typeof tvRenderVideos === 'function') tvRenderVideos(); }
  if (name === 'tool8' && typeof t8Init === 'function') t8Init();
  if (name === 'tool7' && typeof t7Build === 'function') t7Build();
  if (name === 'tool9' && typeof t9Init === 'function') t9Init();
  if (name === 'tool10' && typeof t10Init === 'function') t10Init();   // T10 tách riêng từ Tool 9 (2026-09-10)
  if (name === 'tool9' && typeof t9Step2Refresh === 'function') setTimeout(t9Step2Refresh, 200);   // bước 2 (thumbnail) chỉ mở khi đã có tiêu đề
  if (name === 'toolniche' && typeof nicheInit === 'function') nicheInit();
  if (name === 'toolflow'){ if (typeof tfInit === 'function') tfInit(); if (typeof _autoSaveSyncUI === 'function') _autoSaveSyncUI(); }
  if (name === 'tool2'){ try { t2RenderNguon(); } catch (e) {} }
  if (name === 'toolsettings'){ if (typeof _relocateSettings === 'function') _relocateSettings(); if (typeof tfInit === 'function') tfInit(); if (typeof loadApiSettings === 'function') try { loadApiSettings(); } catch(e){} if (typeof t11Init === 'function') try { t11Init(); } catch(e){} }
  if (name === 'toolvoice'){
    // Ba việc độc lập: OmniVoice có thể chưa cài mà giọng đám mây vẫn phải hiện.
    if (typeof voiceInit === 'function') voiceInit();
    if (typeof giongTaiDS === 'function') giongTaiDS();
    if (typeof giongKiemEngine === 'function') giongKiemEngine();
  }
  if (name === 'toolupscale' && typeof upInit === 'function') upInit();
  if (name === 'toolscript' && typeof tsInit === 'function') tsInit();
  if (name === 'tooladmin' && typeof admListUsers === 'function') admListUsers();
  if (name === 'tooladmin' && typeof admRenderDash === 'function') admRenderDash();
  if (typeof _syncChLang === 'function') _syncChLang();   // áp ngôn ngữ kênh vào tool vừa mở
}

// === L?: const upState ===
const upState = { items: [], running: false, seq: 0, wired: false };

// === L?: let _upThumbBusy ===
let _upThumbBusy = false;

// === L?: function tsInit ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-ts.js (peer=1020c, shared=441c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function tsInit(){
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  const nameEl = document.getElementById('tsProfName'); if (nameEl) nameEl.textContent = p?.tenKenh ? '· ' + p.tenKenh : '';
  const pp = document.getElementById('tsProfPrompt');
  if (pp) pp.textContent = (p?.scriptPrompt || '').trim() || 'Chưa có — bấm "Sửa ở Profile" để thêm phong cách viết kịch bản cho kênh.';
  tsEstimate(); tsOutMeta();
}

async function tsGenerate(rewrite){
  const topic = document.getElementById('tsTopic')?.value.trim();
  if (!topic){ setStatusScript('Nhập chủ đề / tiêu đề trước.', 'error'); return; }
  const words = parseInt(document.getElementById('tsWords')?.value) || 800;
  const lang = document.getElementById('tsLang')?.value || 'Tiếng Việt';
  const tone = document.getElementById('tsTone')?.value || 'Kể chuyện cuốn hút';
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  const sp = (p?.scriptPrompt || '').trim();
  const prompt =
`Bạn là biên kịch chuyên viết lời đọc (voiceover) cho video faceless trên YouTube.
NHIỆM VỤ: Viết MỘT kịch bản lời đọc hoàn chỉnh về chủ đề: "${topic}".
NGÔN NGỮ: ${lang}. GIỌNG VĂN: ${tone}. ĐỘ DÀI: khoảng ${words} từ (chênh lệch tối đa 10%).
${sp ? 'PHONG CÁCH KÊNH — BẮT BUỘC tuân theo (nhưng XEM luật ĐỘ DÀI bên dưới đè lên phần số từ):\n' + sp.replace(/\{\{\s*WORDS\s*\}\}/gi, String(words)) + '\n' : ''}${rewrite ? 'Viết một BẢN KHÁC, cách tiếp cận/mở đầu mới so với thông thường.\n' : ''}
⚠️ ĐỘ DÀI — ƯU TIÊN CAO NHẤT, ĐÈ LÊN MỌI CON SỐ TRONG PHONG CÁCH KÊNH:
- BỎ QUA mọi con số độ dài viết trong phong cách kênh ("tổng ... từ", "ngân sách từ", "sàn cứng", "mỗi phần/cung ... từ", "~... phút"…).
- Tổng độ dài kịch bản BẮT BUỘC ≈ ${words} từ (sai lệch tối đa 10%). Tự co giãn SỐ PHẦN và tỉ lệ mỗi phần cho vừa ${words} từ — giữ cấu trúc/giọng của phong cách kênh nhưng nén/giãn để đúng ${words} từ.
🎣 GIỮ CHÂN — ${sp ? 'TẦNG NỀN; chỗ nào PHONG CÁCH KÊNH ở trên đã nói khác thì THEO PHONG CÁCH KÊNH' : 'bắt buộc'}:
- 15 GIÂY ĐẦU: câu đầu ≤ 15 từ, vào thẳng chuyện. KHÔNG mở bằng năm/bối cảnh/định nghĩa. Cấm sáo ngữ "Hãy tưởng tượng", "Bạn có biết", "Trong thế giới…".
- OPEN LOOP: gieo NGAY ở hook một mâu thuẫn hoặc câu hỏi chưa trả lời. Nhắc lại 2–3 lần rải đều giữa bài, MỖI lần thêm một chi tiết mới (không lặp nguyên văn), TRẢ dứt điểm ở gần kết.
- VẬT DẪN: chọn 1 vật/chi tiết nhỏ cụ thể, cắm ở mở đầu, cho quay lại ≥2 lần trong đó 1 lần gần kết.
- MỖI ĐOẠN đẩy thêm ĐÚNG 1 điều MỚI (sự kiện, con số, hệ quả) — không tô lại ý vừa nói bằng từ khác.
- CẤM: câu dẫn báo hiệu chuyển đoạn ("ít ai biết rằng", "little did you know"), gọi khán giả ("các bạn ơi", "nhớ like"), giảng đạo, kết ngọt sáo.
QUY TẮC ĐẦU RA (rất quan trọng):
- CHỈ trả về LỜI ĐỌC liền mạch. Ký tự ĐẦU TIÊN phải là chữ đầu của câu đầu kịch bản.
- TUYỆT ĐỐI KHÔNG câu dẫn/mở đầu kiểu "The script is complete...", "Here it is:", "Here is the script", "Đây là kịch bản", "Dưới đây là…", không nêu số từ.
- KHÔNG: tiêu đề, dòng "Kịch bản:", đánh số, nhãn [Intro]/[Hook]/[Kết], ghi chú đạo diễn, emoji, markdown, gạch đầu dòng.
- Chia thành các đoạn văn ngắn 2–4 câu, dễ đọc cho giọng nói AI (TTS). Mở đầu NGAY bằng hook; kết bằng câu chốt.
Trả về DUY NHẤT nội dung kịch bản, không thêm bất kỳ lời dẫn nào.`;
  const btn = document.getElementById('tsGenBtn'); if (btn) btn.disabled = true;
  const _tk = _startElapsed('✍️ Đang viết kịch bản', setStatusScript,
    'bản dài / chạy bằng gói Claude-ChatGPT có thể chờ vài phút — cứ để yên');
  try {
    const raw = await callLLM(prompt, { maxTokens: Math.min(16000, Math.round(words * 2.5) + 600) });
    _stopElapsed(_tk);
    const clean = _tsClean(raw);
    const out = document.getElementById('tsOutput'); if (out) out.value = clean;
    tsOutMeta();
    setStatusScript('✓ Đã viết xong. Kiểm tra rồi Đưa vào Giọng nói / Sang Phân Cảnh.', 'ok');
  } catch (e){ _stopElapsed(_tk); setStatusScript('Lỗi: ' + (e.message || e), 'error'); }
  if (btn) btn.disabled = false;
}

// === L?: let VOICE_URL ===
let VOICE_URL = 'http://127.0.0.1:8771';

// === L?: const VOICE_SETUP_URL ===
const VOICE_SETUP_URL = 'https://github.com/khanhtran0393/AI-Novel#giong-noi';

// === L?: let _voiceReady ===
let _voiceReady = false;

// === L?: let _voiceStarting ===
let _voiceStarting = null;

// === L?: let _voicePreset ===
let _voicePreset = '';

async function voiceInit(){
  const st = document.getElementById('voiceBackendStatus');
  if (!window.native?.voiceStart){
    if (st) st.innerHTML = '<span style="color:var(--red)">Chỉ dùng được trong app desktop.</span>';
    return;
  }
  // Xác minh backend còn sống (không chỉ dựa cờ cũ — phòng khi backend đã tắt/khởi động lại).
  const cur = await window.native.voiceStatus().catch(() => null);
  if (cur?.running){ _voiceReady = true; if (cur?.url) VOICE_URL = cur.url; if (st) st.innerHTML = '<span style="color:var(--green)">● Giọng nói sẵn sàng (OmniVoice)</span>'; voiceLoadVoices(); return; }
  _voiceReady = false;
  // Đã cài backend trên máy chưa? (thay vì báo lỗi đỏ → hiện panel hướng dẫn cài)
  const pb = window.native.voiceProbe ? await window.native.voiceProbe().catch(() => null) : null;
  if (pb && !pb.hasRoot){ voiceShowSetup('need-install'); return; }
  if (pb && pb.hasRoot && !pb.hasPython){ voiceShowSetup('need-python'); return; }
  // Có backend → tự khởi động (im lặng) khi mở tab.
  if (st) st.innerHTML = '⏳ Đang khởi động backend giọng nói (OmniVoice)… lần đầu ~30-60s, giữ app mở.';
  if (!_voiceStarting) _voiceStarting = window.native.voiceStart();
  const r = await _voiceStarting; _voiceStarting = null;
  if (r?.ok){ _voiceReady = true; if (r?.url) VOICE_URL = r.url; if (st) st.innerHTML = '<span style="color:var(--green)">● Giọng nói sẵn sàng (OmniVoice)</span>'; voiceLoadVoices(); }
  else if (st) st.innerHTML = '<span style="color:var(--red)">Lỗi khởi động: ' + escapeHtml(r?.error || '') + '</span>';
}

// === L?: function voiceShowSetup ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1468c, shared=1348c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function voiceShowSetup(kind){
  const st = document.getElementById('voiceBackendStatus');
  if (!st) return;
  const needPy = kind === 'need-python';
  const msg = needPy
    ? 'Đã tìm thấy thư mục voice-studio nhưng <b>chưa cài môi trường Python</b>. Mở voice-studio và chạy file cài đặt (setup) một lần, rồi bấm “Kiểm tra lại”.'
    : 'Giọng nói AI chạy <b>ngay trên máy bạn</b> (đọc bao nhiêu cũng miễn phí). Bấm <b>“Cài backend vào máy”</b> — app tự cài vào thư mục của app, <b>không cần chọn nơi lưu</b>. Chỉ cài một lần là xong.';
  st.innerHTML = `
    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:16px 18px;text-align:left;max-width:720px">
      <div style="font-weight:800;font-size:14px;color:var(--text);margin-bottom:6px">🎙 Cần cài backend giọng nói (OmniVoice) trên máy</div>
      <div style="font-size:12.8px;color:var(--text-muted);line-height:1.65;margin-bottom:12px">${msg}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn primary sm" onclick="voiceInstallBackend()">📥 Cài backend vào máy</button>
        <button class="btn ghost sm" onclick="voicePickRoot()">📁 Đã cài nơi khác — chọn thư mục</button>
        <button class="btn ghost sm" onclick="voiceInit()">🔄 Kiểm tra lại</button>
      </div>
    </div>`;
}

async function voiceInstallBackend(){
  if (!window.native?.voiceInstallBackend){ voicePickRoot(); return; }
  const st = document.getElementById('voiceBackendStatus');
  if (st) st.innerHTML = '⏳ Đang chép backend ra máy…';
  const r = await window.native.voiceInstallBackend().catch(() => null);
  if (r?.ok){
    if (st) st.innerHTML = `
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:16px 18px;text-align:left;max-width:760px">
        <div style="font-weight:800;color:var(--green);margin-bottom:6px">✓ Đã chép backend vào máy</div>
        <div style="font-size:12.8px;color:var(--text-muted);line-height:1.7">
          Thư mục: <code style="background:var(--surface-3);padding:2px 6px;border-radius:5px">${escapeHtml(r.path)}</code> (đã mở sẵn).<br>
          <b>Bước tiếp — cài Python + model (1 lần):</b> vào thư mục đó, chạy
          <b>setup-omni.bat</b> (Windows) hoặc <b>setup-omni.command</b> (Mac). Xong bấm <b>🔄 Kiểm tra lại</b>.<br>
          <span style="color:var(--text-dim)">Chi tiết xem file HUONG-DAN-KHACH.md trong thư mục đó.</span>
        </div>
        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
          <button class="btn primary sm" onclick="voiceInit()">🔄 Kiểm tra lại</button>
        </div>
      </div>`;
  } else if (r && !r.canceled){
    if (st) st.insertAdjacentHTML('beforeend', '<div style="color:var(--red);font-size:12px;margin-top:8px">' + escapeHtml(r.error || 'Lỗi cài đặt') + '</div>');
  }
}

// === L?: const _TTS_TEN ===
const _TTS_TEN = { omni: 'OmniVoice' };

// === L?: const _GIONG_THU ===
const _GIONG_THU = 'Xin chào, đây là giọng đọc thử của AI Video Studio.';

// === L?: let _giongDS ===
let _giongDS = [];

// === L?: let _giongChon ===
let _giongChon = '';

// === L?: let _giongLoc ===
let _giongLoc = '*';

// === L?: let _giongPhat ===
let _giongPhat = '';

// === L?: let _giongAudio ===
let _giongAudio = null;

// === L?: const _giongMau ===
const _giongMau = new Map();

// === L?: let _giongSu ===
let _giongSu = [];

// === L?: let _giongTT ===
let _giongTT = { omni: 'no' };

// === L?: let _giongThemMo ===
let _giongThemMo = false;

async function giongTaiDS(){
  const ds = [];
  try {
    const data = await fetch(VOICE_URL + '/api/voices').then(r => r.json());
    const list = Array.isArray(data) ? data : (data.voices || []);
    _voiceList = list;
    for (const v of list){
      // Giọng ⭐ nhà máy của OmniVoice là tiếng Anh, không dùng cho video tiếng Việt.
      // Chỉ GIẤU khỏi thư viện — file vẫn nằm trong voicebank, muốn hiện lại thì bỏ dòng này.
      if (v.is_factory) continue;
      const thietKe = !!(v.attributes && v.attributes.instruct);
      ds.push({
        key: 'omni:' + v.id, engine: 'omni', id: v.id, name: v.name || v.id,
        src: v.is_factory ? 'Giọng có sẵn' : (thietKe ? 'Thiết kế từ mô tả' : 'Clone từ mẫu'),
        kind: v.is_factory ? 'san' : (thietKe ? 'design' : 'clone'),
        tags: (v.tags || []).slice(0, 3),
        lang: (v.attributes && v.attributes.lang) || 'vi',
        factory: !!v.is_factory,
      });
    }
  } catch (e){ /* backend chưa lên — vẫn hiện giọng đám mây */ }
  for (const v of _giongCloud()){
    ds.push({ key: v.engine + ':' + v.id, engine: v.engine, id: v.id, name: v.name,
      src: 'Giọng dựng sẵn', kind: 'san', tags: Array.isArray(v.tags) ? v.tags.slice(0, 3) : [],
      lang: v.lang || 'vi', factory: false, model: v.model || '' });
  }
  _giongDS = ds;
  if (!_giongDS.some(v => v.key === _giongChon)) _giongChon = (_giongDS[0] || {}).key || '';
  giongVe();
}

// === L?: const voiceLoadVoices ===
const voiceLoadVoices = giongTaiDS;

// === L?: function giongVe ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=2411c, shared=2316c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function giongVe(){
  const box = document.getElementById('giongLuoi');
  const chips = document.getElementById('giongChips');
  if (!box) return;

  if (chips){
    const dem = f => _giongDS.filter(v => { const c = _giongLoc; _giongLoc = f; const k = _giongHop(v); _giongLoc = c; return k; }).length;
    const muc = [['*', 'Tất cả']];
    for (const e of ['omni','elevenlabs','openai']) if (_giongDS.some(v => v.engine === e)) muc.push(['e:' + e, _TTS_TEN[e]]);
    for (const [k, t] of [['k:clone','Clone'],['k:design','Thiết kế']]) if (_giongDS.some(v => v.kind === k.slice(2))) muc.push([k, t]);
    const nhan = {};
    for (const v of _giongDS) for (const t of (v.tags || [])) nhan[t] = (nhan[t] || 0) + 1;
    for (const t of Object.keys(nhan).sort((a,b) => nhan[b] - nhan[a]).slice(0, 4)) muc.push([t, t]);
    chips.innerHTML = muc.map(([f, t]) =>
      `<div class="gchip${f === _giongLoc ? ' on' : ''}" onclick="giongDatLoc('${escapeHtml(f)}')">${escapeHtml(t)}<span class="c">${dem(f)}</span></div>`).join('');
  }

  const hien = _giongDS.filter(_giongHop);
  box.innerHTML = hien.map(v => {
    const chon = v.key === _giongChon, dangPhat = v.key === _giongPhat;
    return `<div class="gcard${chon ? ' sel' : ''}${dangPhat ? ' play' : ''}" onclick="giongBam('${escapeHtml(v.key)}')">
      ${v.factory ? '' : `<button class="btn sm ghost gdel" onclick="event.stopPropagation();giongXoa('${escapeHtml(v.key)}')" title="Xoá giọng">✕</button>`}
      <div class="gtop">
        <span class="gpico">${dangPhat ? '❙❙' : '▶'}</span>
        <div style="min-width:0"><div class="gname">${escapeHtml(v.name)}</div><div class="gsrc">${escapeHtml(v.src)}</div></div>
      </div>
      <div class="gtags">${(v.tags || []).map(t => `<span class="gtg">${escapeHtml(t)}</span>`).join('')}<span class="gtg eng">${escapeHtml(_TTS_TEN[v.engine])}</span></div>
    </div>`;
  }).join('') + `<div class="gadd" onclick="giongThemBat()">＋ Thêm giọng</div>`;

  const n = document.getElementById('giongDem'); if (n) n.textContent = _giongDS.length + ' giọng';
  const cur = _giongDS.find(v => v.key === _giongChon);
  const lb = document.getElementById('giongDangChon');
  if (lb) lb.textContent = cur ? (cur.name + ' · ' + _TTS_TEN[cur.engine]) : 'chưa chọn giọng';
  giongVeThanh();
}

// === L?: function giongVeThanh ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=997c, shared=347c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function giongVeThanh(){
  const cur = _giongDS.find(v => v.key === _giongChon);
  const e = cur ? cur.engine : 'omni';
  for (const [id, hop] of [['slOnDinh', e === 'elevenlabs'], ['slTuongDong', e === 'elevenlabs'], ['slGap', e === 'omni']]){
    const el = document.getElementById(id);
    if (el) el.classList.toggle('off', !hop);
  }
}

// === L?: function giongDocTuyChon ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=843c, shared=453c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function giongDocTuyChon(){
  const s = id => parseFloat((document.getElementById(id) || {}).value);
  return {
    tocDo: isFinite(s('voiceSpeed')) ? s('voiceSpeed') : 1,
    gap: isFinite(s('voiceGap')) ? s('voiceGap') : 300,
    onDinh: isFinite(s('voiceOnDinh')) ? s('voiceOnDinh') : 0.5,
    tuongDong: isFinite(s('voiceTuongDong')) ? s('voiceTuongDong') : 0.75,
    lang: (document.getElementById('voiceLang') || {}).value || 'vi',
  };
}

// === L?: const _TTS_LOI ===
const _TTS_LOI = [
  [/free users cannot use library voices/i,
   'Giọng này lấy từ Voice Library (kho cộng đồng) — tài khoản miễn phí không gọi qua API được. Dùng giọng premade của ElevenLabs (Adam, Rachel, Bill…), hoặc nâng gói, hoặc tự clone giọng bằng OmniVoice.'],
  [/missing the permission ([a-z_]+)/i,
   'Key bị giới hạn quyền — vào elevenlabs.io → API Keys, bật quyền còn thiếu cho key này.'],
  [/(quota|character limit|exceeds your)/i,
   'Hết hạn mức ký tự tháng này của ElevenLabs. Chờ sang kỳ mới, nâng gói, hoặc chuyển sang giọng OmniVoice chạy máy (không giới hạn).'],
  [/voice.{0,12}not.{0,4}found|invalid voice/i,
   'Không tìm thấy voice id này. Kiểm lại chuỗi id, hoặc giọng đã bị xoá khỏi tài khoản.'],
  [/(invalid[_ ]api[_ ]key|incorrect api key|unauthorized|authentication)/i,
   'Key sai hoặc hết hạn. Dán lại key ở ô KEY bên trên rồi bấm Lưu key.'],
  [/rate.?limit|too many requests/i,
   'Gọi quá nhanh, nhà cung cấp chặn tạm. Chờ một lát rồi thử lại.'],
];

// === L?: function _ttsGiaiThich ===
function _ttsGiaiThich(msg){
  for (const [re, vi] of _TTS_LOI) if (re.test(msg)) return vi + ' [' + String(msg).slice(0, 110) + ']';
  return msg;
}

// === L?: function _ttsBlob ===
function _ttsBlob(r, ten){
  if (!r) throw new Error(ten + ': không có phản hồi.');
  if (r.error) throw new Error(ten + ': ' + r.error);
  if (!r.b64){
    let m = r.text || ('HTTP ' + (r.status || '?'));
    try { const j = JSON.parse(r.text); m = (j.error && (j.error.message || j.error)) || j.detail && (j.detail.message || j.detail) || m; } catch (e){}
    throw new Error(ten + ': ' + _ttsGiaiThich(String(m)).slice(0, 320));
  }
  const bin = atob(r.b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: r.mime || 'audio/mpeg' });
}

async function _ttsOmni(v, text, o, onTien){
  if (!_voiceReady){ await voiceInit(); if (!_voiceReady) throw new Error('Backend OmniVoice chưa sẵn sàng.'); }
  const body = { text, language: o.lang, speed: o.tocDo, gap_ms: Math.round(o.gap), attributes: {}, preset_id: v.id };
  const sub = await fetch(VOICE_URL + '/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const tid = sub.task_id;
  if (!tid) throw new Error('Backend không nhận việc.');
  for (let i = 0; i < 900; i++){
    await new Promise(r => setTimeout(r, 1000));
    const s = await fetch(VOICE_URL + '/api/status/' + tid).then(r => r.json());
    if (s.total && onTien) onTien(s.progress + '/' + s.total + ' khối');
    if (s.status === 'completed' || s.status === 'done'){
      if (!s.results || !s.results.merged) throw new Error('Backend không trả file.');
      return await fetch(VOICE_URL + s.results.merged).then(r => r.blob());
    }
    if (s.status === 'failed' || s.status === 'error') throw new Error(s.error || 'Backend báo lỗi.');
  }
  throw new Error('Quá lâu không xong.');
}

async function _ttsEleven(v, text, o){
  const k = _ttsKey('elevenlabs');
  if (!k) throw new Error('Chưa có key ElevenLabs — bấm "Sửa key".');
  return _ttsBlob(await window.native.ttsFetch({
    url: 'https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(v.id),
    method: 'POST',
    headers: { 'xi-api-key': k, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({
      text, model_id: v.model || 'eleven_multilingual_v2',
      voice_settings: { stability: o.onDinh, similarity_boost: o.tuongDong, speed: o.tocDo },
    }),
    timeoutMs: 300000,
  }), 'ElevenLabs');
}

async function _ttsOpenAI(v, text, o){
  const k = _ttsKey('openai');
  if (!k) throw new Error('Chưa có key OpenAI — bấm "Sửa key".');
  return _ttsBlob(await window.native.ttsFetch({
    url: 'https://api.openai.com/v1/audio/speech',
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: v.model || 'gpt-4o-mini-tts', input: text, voice: v.id,
      speed: Math.max(0.25, Math.min(4, o.tocDo)), response_format: 'mp3',
    }),
    timeoutMs: 300000,
  }), 'OpenAI');
}

async function ttsDoc(text, onTien){
  const uu = _giongDS.find(v => v.key === _giongChon) || _giongDS[0];
  if (!uu) throw new Error('Chưa có giọng nào trong thư viện.');
  const thu = [uu].concat(_giongDS.filter(v => v.engine !== uu.engine && _giongTT[v.engine] === 'ok'));
  let loiDau = null;
  for (const v of thu){
    try {
      if (onTien && v !== uu) onTien('chuyển sang ' + _TTS_TEN[v.engine]);
      const blob = await _ttsChay(v, text, giongDocTuyChon(), onTien);
      return { blob, giong: v, luiVe: v !== uu };
    } catch (e){
      if (!loiDau) loiDau = e;
      try { novaLog('🎙 ' + _TTS_TEN[v.engine] + ' lỗi — ' + (e.message || e), 'warn'); } catch (_){}
    }
  }
  throw loiDau || new Error('Không engine nào đọc được.');
}

async function voiceGenerate(){
  if (typeof gateTool === 'function' && gateTool('toolvoice')) return;
  const text = ((document.getElementById('voiceText') || {}).value || '').trim();
  if (!text){ giongBao('Nhập nội dung trước.', 'red'); return; }
  const btn = document.getElementById('voiceGenBtn');
  if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang tạo…'; }
  try {
    giongBao('Đang tạo giọng…');
    const t0 = Date.now();
    const { blob, giong, luiVe } = await ttsDoc(text, s => giongBao('Đang tạo… ' + s));
    const url = URL.createObjectURL(blob);
    const au = new Audio(url);
    const giay = await new Promise(r => { au.onloadedmetadata = () => r(au.duration || 0); au.onerror = () => r(0); });
    _giongSu.unshift({ url, blob, ten: giong.name, engine: giong.engine, giay, text, khi: Date.now() });
    _giongSu = _giongSu.slice(0, 12);
    giongSuVe();
    giongBao('✓ Xong sau ' + Math.round((Date.now() - t0) / 1000) + ' giây' + (luiVe ? ' (đã lui về ' + _TTS_TEN[giong.engine] + ')' : ''), 'green');
  } catch (e){
    giongBao('Lỗi: ' + (e.message || e), 'red');
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = '🎙 Tạo giọng'; }
  }
}

// === L?: function giongSuVe ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1425c, shared=1003c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function giongSuVe(){
  const box = document.getElementById('giongSu');
  if (!box) return;
  if (!_giongSu.length){ box.innerHTML = '<div class="empty-state">Chưa tạo bản nào trong phiên này.</div>'; return; }
  box.innerHTML = _giongSu.map((h, i) => {
    const ph = Math.floor(h.giay / 60), gi = Math.round(h.giay % 60);
    return `<div class="grow-row" onclick="giongSuPhat(${i})">
      <span class="gpico">▶</span>
      <div style="flex:1;min-width:0">
        <div class="gh-txt">${escapeHtml(h.text.slice(0, 70))}${h.text.length > 70 ? '…' : ''}</div>
        <div class="gh-meta">${escapeHtml(h.ten)} · ${ph}:${String(gi).padStart(2,'0')} · ${_giongKhiNao(h.khi)}</div>
      </div>
      <div class="gh-act">
        <button class="btn sm ghost" onclick="event.stopPropagation();giongSuTai(${i})">Tải</button>
        <button class="btn sm ghost" onclick="event.stopPropagation();giongSuDungChoVideo(${i})">Dùng cho video</button>
      </div>
    </div>`;
  }).join('');
}

// === L?: function giongVeKey ===
function giongVeKey(){
  const eng = ((document.getElementById('gtEngine') || {}).value) || 'elevenlabs';
  const nha = document.getElementById('gtKeyNha'); if (nha) nha.textContent = _TTS_TEN[eng].toUpperCase();
  const o = document.getElementById('gtKey'); if (o) o.value = '';
  const tt = document.getElementById('gtKeyTT');
  if (!tt) return;
  const k = _ttsKey(eng);
  const rieng = (localStorage.getItem(_TTS_KHOA[eng]) || '').trim();
  if (!k) tt.innerHTML = '<span style="color:var(--red)">— chưa có key</span>';
  else tt.innerHTML = '<span style="color:var(--green)">✓ đã có (…' + escapeHtml(k.slice(-4)) + ')</span>'
    + (!rieng && eng === 'openai' ? ' <span style="color:var(--text-dim)">mượn từ tab Cài đặt</span>' : '')
    + ' <span style="color:var(--text-dim)">— dán key mới để thay</span>';
}

// === L?: let _giongTra ===
let _giongTra = {};

// === L?: let _giongTraHen ===
let _giongTraHen = null;

// === L?: let _giongTraId ===
let _giongTraId = '';

// === L?: let _giongTenTay ===
let _giongTenTay = false;

async function _giongTraNgay(id){
  const tt = document.getElementById('gtVoiceTT');
  const eng = ((document.getElementById('gtEngine') || {}).value) || 'elevenlabs';
  if (eng !== 'elevenlabs'){ if (tt) tt.textContent = ''; return; }
  const k = _ttsKey('elevenlabs');
  if (!k){ if (tt) tt.innerHTML = '<span style="color:var(--red)">Chưa có key ElevenLabs — lưu key bên dưới rồi dán lại voice id.</span>'; return; }
  try {
    const r = await window.native.llmFetch({
      url: 'https://api.elevenlabs.io/v1/voices/' + encodeURIComponent(id),
      method: 'GET', headers: { 'xi-api-key': k }, timeoutMs: 20000,
    });
    const j = JSON.parse(r.text || '{}');
    if (!r.ok){
      const d = j.detail || j.error || {};
      const vi = d.message || j.message || ('HTTP ' + r.status);
      if (document.getElementById('gtVoiceId').value.trim() !== id) return;   // đã gõ tiếp
      tt.innerHTML = '<span style="color:var(--' + (/missing the permission/i.test(vi) ? 'amber' : 'red') + ')">' + escapeHtml(String(vi).slice(0, 170)) + '</span>'
        + (/missing the permission/i.test(vi) ? '<span style="color:var(--text-dim)"> — bật quyền voices_read cho key, hoặc cứ tự gõ Tên giọng rồi lưu.</span>' : '');
      return;
    }
    if (document.getElementById('gtVoiceId').value.trim() !== id) return;
    const lb = j.labels || {};
    const tags = ['gender','age','accent','use_case','descriptive']
      .map(x => lb[x]).filter(Boolean).map(s => String(s).replace(/_/g, ' ')).slice(0, 3);
    _giongTra = { id, name: j.name || '', tags };
    const ten = document.getElementById('gtTen');
    if (ten && j.name && !_giongTenTay) ten.value = j.name;
    // category 'premade' = giọng gốc của ElevenLabs, gói miễn phí gọi API được.
    // Mọi loại khác (professional/cloned/generated — tức lấy từ Voice Library)
    // đều bị chặn ở gói miễn phí. Báo trước, đừng để lưu xong mới biết.
    const chuan = String(j.category || '').toLowerCase() === 'premade';
    tt.innerHTML = '<span style="color:var(--green)">✓ ' + escapeHtml(j.name || '(không tên)') + '</span>'
      + (tags.length ? '<span style="color:var(--text-dim)"> · ' + escapeHtml(tags.join(' · ')) + '</span>' : '')
      + (j.category ? '<span style="color:var(--' + (chuan ? 'text-dim' : 'amber') + ')"> · ' + escapeHtml(j.category) + '</span>' : '')
      + (chuan ? '' : '<div style="color:var(--amber);margin-top:4px">Giọng từ Voice Library — tài khoản ElevenLabs miễn phí KHÔNG gọi được qua API. Chọn giọng <b>premade</b>, nâng gói, hoặc dùng "Nhân bản về máy" nếu gói bạn cho phép.</div>');
  } catch (e){
    if (tt) tt.innerHTML = '<span style="color:var(--red)">Tra không được: ' + escapeHtml(String(e.message || e).slice(0, 120)) + '</span>';
  }
}

// === L?: function giongMoKey ===
function giongMoKey(eng){
  const b = document.getElementById('giongThemBox');
  if (b && b.style.display === 'none'){ _giongThemMo = false; giongThemBat(); }
  const c = document.getElementById('giongThemCach'); if (c) c.value = 'nhap';
  const e = document.getElementById('gtEngine'); if (e && eng) e.value = eng;
  giongThemDoi();
  const o = document.getElementById('gtKey');
  if (o){ o.scrollIntoView({ block: 'center' }); o.focus(); }
}

async function _giongNhanBan(eng, id, model, ten, nhan){
  if (!_voiceReady){ await voiceInit(); if (!_voiceReady) throw new Error('Backend OmniVoice chưa sẵn sàng — cần nó để giữ bản sao.'); }
  const lang = ((document.getElementById('voiceLang') || {}).value === 'en') ? 'en' : 'vi';
  const doan = _GIONG_MAU_CLONE[lang];
  giongBao('Đang nhờ ' + _TTS_TEN[eng] + ' đọc ' + doan.length + ' ký tự làm mẫu…');
  const o = giongDocTuyChon();
  const gia = { engine: eng, id, model };
  const blob = eng === 'elevenlabs' ? await _ttsEleven(gia, doan, o) : await _ttsOpenAI(gia, doan, o);
  if (!blob || blob.size < 4000) throw new Error(_TTS_TEN[eng] + ' trả file rỗng.');
  giongBao('Đang nạp mẫu ' + Math.round(blob.size / 1024) + ' KB vào OmniVoice…');
  const fd = new FormData();
  fd.append('file', new File([blob], 'mau-' + eng + '.mp3', { type: blob.type || 'audio/mpeg' }));
  const up = await fetch(VOICE_URL + '/api/upload', { method: 'POST', body: fd }).then(r => r.json());
  if (!up || !up.path) throw new Error('OmniVoice không nhận được file mẫu.');
  await fetch(VOICE_URL + '/api/voices', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ten, ref_text: doan, ref_audio: up.path, attributes: { lang }, tags: nhan.concat(['nhân bản']) }),
  }).then(r => r.json());
}

async function giongXoa(key){
  const v = _giongDS.find(x => x.key === key);
  if (!v || v.factory) return;
  if (!confirm('Xoá giọng "' + v.name + '"?')) return;
  try {
    if (v.engine === 'omni') await fetch(VOICE_URL + '/api/voices/' + v.id, { method: 'DELETE' });
    else _giongCloudLuu(_giongCloud().filter(x => !(x.engine === v.engine && x.id === v.id)));
    _giongMau.delete(key);
    await giongTaiDS();
  } catch (e){ giongBao('Xoá lỗi: ' + (e.message || e), 'red'); }
}

// === L?: let mvScenes ===
let mvScenes = [];

// === L?: let mvUploaded ===
let mvUploaded = [];

// === L?: function _mvRules ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=2290c, shared=2188c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _mvRules(cfg){
  // Câu khoá style phải theo PROFILE — trước đây ép cứng "flat 2D" nên kênh ảnh thật/lịch sử cũng bị kéo về hoạt hình.
  const _pm = (typeof _profileMedium === 'function') ? _profileMedium(typeof getProfile === 'function' ? getProfile() : null) : { is2D: true, isPhoto: false };
  const _lookLock = _pm.isPhoto ? 'Keep the photorealistic look and stable facial features throughout.'
    : _pm.is2D ? 'Keep the flat 2D look and stable facial features throughout.'
    : 'Keep the exact art style of the still image and stable facial features throughout.';
  const _exStyle = _pm.isPhoto ? 'Photorealistic documentary cinematography, muted desaturated palette, tense somber mood.'
    : _pm.is2D ? 'Dark 2D hand-drawn storybook style, muted desaturated palette, tense somber mood.'
    : 'Same art style as the still image, muted desaturated palette, tense somber mood.';
  return `CÔNG THỨC VEO CHÍNH THỨC — viết ĐÚNG THỨ TỰ 5 phần, camera ĐỨNG ĐẦU:
[Cinematography] → [Subject] → [Action] → [Context] → [Style & Ambiance]
Ví dụ mẫu (bám sát giọng văn này):
"Very slow push-in, close-up. A young farmer's solemn face. He slowly glances toward the tree line, faint breath visible in the cold air. Village clearing before dawn, drifting mist and a distant flicker of torchlight behind him. ${_exStyle} ${_lookLock}"

QUY TẮC BẮT BUỘC:
1. Cinematography mở đầu = "${cfg.camText}" + cỡ cảnh (close-up / medium / wide establishing shot) suy ra từ nội dung ảnh.
2. Chỉ mô tả CHUYỂN ĐỘNG áp lên ảnh có sẵn — GIỮ NGUYÊN nhân vật, bố cục, art-style. KHÔNG thêm vật thể/nhân vật mới, KHÔNG đổi cảnh, KHÔNG tả lại chi tiết ngoại hình (ảnh đã khóa).
3. Action = chuyển động NHỎ, CHẬM (breathing, blinking, gaze shift, hair/cloth sway, thin wisp of smoke, flickering firelight, drifting mist, ripples, falling leaves). Mức độ: ${cfg.intText}. Chuyển động tối thiểu để KHÔNG méo mặt/mask.
4. TUYỆT ĐỐI KHÔNG có câu thoại và KHÔNG dùng dấu ngoặc kép cho lời nói (kênh này lồng tiếng riêng — không để nhân vật cất tiếng, không mô tả âm thanh/nhạc/SFX).
5. Style & Ambiance ở CUỐI, kết bằng: "${_lookLock}"${cfg.extra ? '\n6. Lưu ý thêm: ' + cfg.extra : ''}`;
}

async function _mvGenVision(s, cfg){
  const messages = [{ role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: s.img.mediaType || 'image/png', data: s.img.base64 } },
    { type: 'text', text: `Ảnh trên là KHUNG HÌNH ĐẦU TIÊN cho 1 clip Veo (image→video) ${cfg.clip}s. Nhìn ảnh và viết 1 prompt CHUYỂN ĐỘNG bằng TIẾNG ANH cho Veo.

${_mvRules(cfg)}

Trả về CHỈ 1 JSON: {"motion":"..."}` },
  ] }];
  const data = await callLLMJson('', { maxTokens: 900, messages, validate: d => d && typeof d.motion === 'string' && d.motion.length > 20 });
  return data.motion.trim();
}

async function mvGenerate(){
  if (typeof gateTool==='function' && gateTool('tool6')) return;
  if (!mvScenes.length){ setStatusBar('statusMvVid', 'Chưa có ảnh — tải ảnh lên (test) hoặc "Lấy ảnh cảnh đã tạo".', 'error'); return; }
  const cfg = _mvCfg();
  if (!state.motionPrompts) state.motionPrompts = {};
  const btn = document.getElementById('mvGenBtn'); btn.disabled = true;
  const stop = document.getElementById('mvStopBtn'); stop.style.display = '';
  window.__mvStop = false;
  setStatusBar('statusMvVid', '✨ Đang sinh prompt chuyển động…', 'working');
  let done = 0;
  const tick = () => { done++; mvRender(); setStatusBar('statusMvVid', `Đang sinh… ${done}/${mvScenes.length}`, 'working'); };
  try {
    const visionOnes = mvScenes.filter(s => s.uploaded && !s.imgPrompt);
    const textOnes = mvScenes.filter(s => !(s.uploaded && !s.imgPrompt));

    // Đường VISION cho ảnh tải lên (từng ảnh, model tự nhìn).
    for (const s of visionOnes){
      if (window.__mvStop) break;
      try { state.motionPrompts[s.id] = await _mvGenVision(s, cfg); }
      catch (e){ state.motionPrompts[s.id] = ''; }
      tick();
    }

    // Đường TEXT (batch) cho cảnh đã có mô tả từ pipeline.
    const BATCH = 8;
    for (let i = 0; i < textOnes.length && !window.__mvStop; i += BATCH){
      const chunk = textOnes.slice(i, i + BATCH);
      const list = chunk.map(s => `[${s.id}] Lời VO: "${(s.vo || '').replace(/\s+/g, ' ').slice(0, 160)}" | Nội dung ảnh: ${(s.imgPrompt || '').replace(/\s+/g, ' ').slice(0, 400)}`).join('\n');
      const prompt = `Bạn là chuyên gia prompt IMAGE-TO-VIDEO cho GOOGLE VEO. Mỗi cảnh dưới đây ĐÃ CÓ ẢNH TĨNH — ảnh đó là KHUNG HÌNH ĐẦU TIÊN. Viết 1 prompt CHUYỂN ĐỘNG bằng TIẾNG ANH để Veo làm ảnh động thành clip ${cfg.clip}s.

${_mvRules(cfg)}

Trả về CHỈ 1 JSON: {"shots":[{"id":"<đúng id>","motion":"..."}]}

CẢNH:
${list}`;
      const data = await callLLMJson(prompt, { maxTokens: 2200, validate: d => d && Array.isArray(d.shots) });
      for (const sh of (data.shots || [])){ if (sh && sh.id && sh.motion) state.motionPrompts[String(sh.id)] = String(sh.motion).trim(); }
      done += chunk.length; mvRender();
      setStatusBar('statusMvVid', `Đang sinh… ${done}/${mvScenes.length}`, 'working');
    }
    saveState(true); mvRender();
    const okc = mvScenes.filter(s => state.motionPrompts[s.id]).length;
    setStatusBar('statusMvVid', window.__mvStop ? `Đã dừng. ${okc} prompt.` : `✓ Xong ${okc}/${mvScenes.length} prompt chuyển động.`, 'ok');
  } catch (e){ setStatusBar('statusMvVid', 'Lỗi: ' + (e.message || e), 'error'); }
  finally { btn.disabled = false; stop.style.display = 'none'; }
}

// === L?: const tvState ===
const tvState = { mode: 'scene', selected: new Set(), initSel: false };

// === L?: let mvVideoBlobs ===
let mvVideoBlobs = {};

async function mvVideoGenerate(){
  if (typeof gateTool==='function' && gateTool('tool6')) return;
  const flow = (a, p) => flowBridge.call(a, p);   // theo chế độ: extension mode → extension, builtin → native
  if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1500))) { setStatusBar('statusMvVid', 'Chưa kết nối tài khoản. Vào Cài đặt kết nối/đăng nhập trước.', 'error'); return; }
  if (!mvScenes.length) mvLoadScenes();
  const mp = state.motionPrompts || {};
  const targets = mvScenes.filter(s => mp[s.id]);
  if (!targets.length){ setStatusBar('statusMvVid', 'Chưa có prompt chuyển động cho cảnh nào. Sinh prompt trước.', 'error'); return; }
  const aspect = document.getElementById('mvVidAspect').value;
  const durationSecs = parseInt(document.getElementById('mvVidDur').value, 10) || 8;
  const modelName = document.getElementById('mvVidModel').value.trim();   // để trống → native tự chọn abra_r2v_<dur>s
  if (!state.sceneVideos) state.sceneVideos = {};
  const btn = document.getElementById('mvVidGenBtn'); btn.disabled = true;
  const stop = document.getElementById('mvVidStopBtn'); stop.style.display = '';
  window.__mvVidStop = false;
  try { await flow('POOL_RESET'); } catch { /* */ }
  // Số luồng song song = số tài khoản Flow đang dùng được (mỗi account 1 cảnh cùng lúc).
  let conc = 3;
  try { const st = await flow('GET_STATUS'); const n = (st.accounts || []).filter(a => a.hasToken && a.enabled !== false).length; if (n) conc = Math.min(Math.max(n, 1), 8); } catch { /* */ }
  const total = targets.length; let done = 0, okc = 0, lastCredit = null;
  const work = async (s) => {
    if (window.__mvVidStop) return;
    try {
      let r = await flow('POOL_GEN_VIDEO', {
        prompt: mp[s.id], aspect, durationSecs, modelName, sceneId: s.id,
        image: { base64: s.img.base64, mime: s.img.mediaType || 'image/png' }, withData: true,
      });
      r = await _videoAppResolve(r);   // extension farm mode → app resolve file video
      if (r && r.ok && (r.video?.b64 || r.videoUrl)){
        if (r.video?.b64){ mvVideoBlobs[s.id] = { b64: r.video.b64, mime: r.video.mime || 'video/mp4' }; autoSaveMedia(_mvVidName(s.id), r.video.b64, 'video'); }
        state.sceneVideos[s.id] = { url: r.videoUrl || null, account: r.account || null, credits: (r.credits ?? null), hasBlob: !!(r.video?.b64) };
        if (r.credits != null) lastCredit = r.credits;
        okc++;
      } else {
        state.sceneVideos[s.id] = { error: (r && (r.error || r.raw)) || 'Không rõ lỗi', account: r && r.account || null };
      }
      // Nhật ký per-cảnh + xoay tài khoản (như ảnh)
      try {
        const rot = (r && Array.isArray(r.rotated)) ? r.rotated : [];
        for (const ex of rot) novaLog('⚠️ ' + ex + ' hết lượt/credit → chuyển video cảnh ' + s.id + ' sang ' + ((r && r.account) || 'tài khoản khác'), 'warn');
        if (r && r.ok && (r.video?.b64 || r.videoUrl)) novaLog('✅ video cảnh ' + s.id + ' · tài khoản ' + ((r && r.account) || '?') + ' · thành công', 'ok');
        else { const em = String((r && (r.error || r.raw)) || ''); const q = /QUOTA|EXHAUSTED|hết giới hạn|INSUFFICIENT|CREDIT|PAYGATE|LIMIT/i.test(em); novaLog((q ? '⚠️ ' : '❌ ') + 'video cảnh ' + s.id + ' · ' + ((r && r.account) ? ('tài khoản ' + r.account + ' · ') : '') + (q ? 'hết lượt/credit → hết tài khoản' : (em || 'lỗi')), q ? 'warn' : 'err'); }
      } catch (e4) {}
    } catch (e){ state.sceneVideos[s.id] = { error: e.message || String(e) }; novaLog('❌ video cảnh ' + s.id + ' · ' + (e.message || String(e)), 'err'); }
    done++; mvVideoRender();
    setStatusBar('statusMvVid', `🎬 ${done}/${total} xong${lastCredit != null ? ` · còn ~${lastCredit} credit` : ''}…`, done < total ? 'working' : 'ok');
    try { saveState(true); } catch { /* */ }
    await _mvPersistVideos();
  };
  setStatusBar('statusMvVid', `🎬 Đang render ${total} cảnh · ${conc} luồng song song… mỗi cảnh ~1-3 phút.`, 'working');
  await _mvRunLimited(targets, conc, work);
  await _mvPersistVideos();
  btn.disabled = false; stop.style.display = 'none';
  setStatusBar('statusMvVid', window.__mvVidStop ? `Đã dừng. ${okc}/${total} video xong.` : `✓ Xong ${okc}/${total} video${lastCredit != null ? ` · còn ~${lastCredit} credit` : ''}.`, okc ? 'ok' : 'error');
}

// === L?: let tvResults ===
let tvResults = [];

async function tvGenerate(retryOnly){
  if (typeof gateTool === 'function' && gateTool('tool6')) return;
  if (window.__tvRunning) return;
  if (typeof flowBridge === 'undefined' || !(await flowBridge.waitReady(1500))){ setStatusBar('statusMvVid', 'Chưa kết nối tài khoản. Vào Cài đặt kết nối/đăng nhập.', 'error'); return; }
  let items = retryOnly ? tvResults.filter(r => r.status === 'err').map(r => r._item).filter(Boolean) : _tvBuildItems();
  if (!items.length){ setStatusBar('statusMvVid', retryOnly ? 'Không có video lỗi để thử lại.' : (tvState.mode === 'prompt' ? 'Chưa nhập prompt.' : 'Chưa chọn cảnh (hoặc chưa có ảnh).'), 'error'); return; }
  const st = await flowBridge.call('GET_STATUS');
  if (!st || (!st.hasToken && !((st.accountCount || 0) > 0))){ setStatusBar('statusMvVid', 'Chưa đăng nhập. Vào Cài đặt.', 'error'); return; }
  const aspect = document.getElementById('mvVidAspect').value;
  const durationSecs = parseInt(document.getElementById('mvVidDur').value, 10) || 8;
  const modelSlug = document.getElementById('mvVidModel').value.trim();
  let modelKey = '';
  if (modelSlug){ try { const r = await flowBridge.call('VIDEO_MODEL_STATUS'); tvModelKeys = (r && r.modelKeys) || tvModelKeys; } catch (e){} const mk = tvModelKeys[modelSlug] || TV_BUILTIN_MODEL_KEYS[modelSlug]; if (!mk){ setStatusBar('statusMvVid', '⚠️ Model "' + (TV_MODEL_LABEL[modelSlug] || modelSlug) + '" không hỗ trợ.', 'error'); return; } modelKey = mk; }
  const cMode = document.getElementById('mvVidConc')?.value || '0';
  const conc = cMode === '0' ? Math.min(Math.max(st.accountCount || 1, 1), 8) : (parseInt(cMode) || 1);
  const tvRes = document.getElementById('mvVidRes')?.value || '720p';
  if (tvRes === '1080p'){ try { const us = await window.native.flowChrome('VIDEO_UPSCALE_STATUS').catch(()=>null); if (!us || !us.learned){ setStatusBar('statusMvVid', '⚠️ Chọn 1080p nhưng chưa "học nâng 1080p". Bấm 🎓 Học nâng 1080p (ô vàng) trước, hoặc đổi về 720p.', 'error'); return; } } catch(e){} }
  if (!retryOnly) tvResults = items.map(it => ({ id: it.id, name: it.name, status: 'wait', pct: 0, _item: it }));
  else items.forEach(it => { const r = tvResults.find(x => x.id === it.id); if (r){ r.status = 'wait'; r.pct = 0; r.err = ''; } });
  window.__tvRunning = true; window.__mvVidStop = false; _mvVidSyncBtn(true);
  try { await flowBridge.call('POOL_RESET'); } catch (e) { /* */ }
  tvRenderVideos();
  let done = 0, err = 0; const total = items.length;
  setStatusBar('statusMvVid', `🎬 Render ${total} video · ${conc} luồng… mỗi clip ~1-3 phút.`, 'working');
  // ── Nhật ký chi tiết (kiểu chuyên nghiệp) ──
  const _modelLbl = (typeof TV_MODEL_LABEL !== 'undefined' && TV_MODEL_LABEL[modelSlug]) || modelSlug || 'mặc định';
  const _asCfg = _autoSaveCfg();
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  novaLog('▶ Bắt đầu tạo ' + total + ' video (Text→Video)', 'acc');
  novaLog('  • Model: ' + _modelLbl + ' · Độ dài: ' + durationSecs + 's · Tỉ lệ: ' + aspect + ' · Độ nét: ' + tvRes + (tvRes === '1080p' ? ' (nâng)' : ''), 'acc');
  novaLog('  • Tài khoản: ' + (st.accountCount || 1) + ' · Luồng song song: ' + conc, 'acc');
  novaLog('  • Lưu về máy: ' + (_asCfg.enabled && _asCfg.folder ? _asCfg.folder : 'Tắt (chỉ hiện trong app, bấm ↓ để tải)'), 'acc');
  novaLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'acc');
  await _mvRunLimited(items, conc, async (it) => {
    if (window.__mvVidStop) return;
    const row = tvResults.find(x => x.id === it.id); if (!row) return;
    row.status = 'gen'; row.pct = 6; tvRenderVideos();
    novaLog('🎬 ' + it.name + ' · gửi prompt: "' + _logClip(it.prompt) + '" → Veo đang dựng…', 'acc');
    const tick = setInterval(() => { if (row.status === 'gen'){ row.pct = Math.min(90, row.pct + Math.random() * 6); tvRenderVideos(); } }, 2500);
    try {
      let r = await flowBridge.call('POOL_GEN_VIDEO', { prompt: it.prompt, aspect, durationSecs, modelKey, resolution: tvRes, sceneId: it.sceneId || it.id, image: it.image || undefined, withData: true });
      r = await _videoAppResolve(r, { resolution: tvRes, aspect });   // extension farm mode → app resolve (+ nâng 1080p nếu chọn)
      clearInterval(tick);
      let savedPath = null;
      if (r && r.ok && (r.video?.b64 || r.videoUrl)){
        row.status = 'done'; row.pct = 100; row.videoUrl = r.videoUrl || null;
        if (r.video?.b64){ row.b64 = r.video.b64; row.mime = r.video.mime || 'video/mp4'; try { const sv = await autoSaveMedia(it.name + '.mp4', r.video.b64, 'video'); if (sv && sv.path) savedPath = sv.path; } catch (e2) { /* */ } }
        done++;
      } else { row.status = 'err'; row.err = _bulkFriendlyErr(String((r && (r.error || r.raw)) || 'Không rõ lỗi')); err++; }
      // Nhật ký per-video + xoay tài khoản
      try {
        const rot = (r && Array.isArray(r.rotated)) ? r.rotated : [];
        for (const ex of rot) novaLog('⚠️ ' + ex + ' hết lượt/credit → chuyển ' + it.name + ' sang ' + ((r && r.account) || 'tài khoản khác'), 'warn');
        if (row.status === 'done'){
          const sz = (r && r.video && r.video.size) ? ' · ' + _logMB(r.video.size) : '';
          const cr = (r && r.credits != null) ? ' · còn ' + r.credits + ' credit' : '';
          const res = (r && r.resolution) ? ' · ' + r.resolution : '';
          novaLog('✅ ' + it.name + '.mp4 · tài khoản ' + ((r && r.account) || '?') + ' · thành công' + res + sz + cr, 'ok');
          if (savedPath) novaLog('   💾 đã lưu: ' + savedPath, 'ok');
        }
        else { const q = /QUOTA|EXHAUSTED|hết giới hạn|INSUFFICIENT|CREDIT|PAYGATE|LIMIT/i.test(String(row.err)); novaLog((q ? '⚠️ ' : '❌ ') + it.name + ' · ' + ((r && r.account) ? ('tài khoản ' + r.account + ' · ') : '') + (q ? 'hết lượt/credit' : (row.err || 'lỗi')), q ? 'warn' : 'err'); }
      } catch (e5) {}
    } catch (e){ clearInterval(tick); row.status = 'err'; row.err = e.message || String(e); err++; novaLog('❌ ' + it.name + ' · ' + (e.message || String(e)), 'err'); }
    tvRenderVideos();
    setStatusBar('statusMvVid', `🎬 ${done} xong · ${err} lỗi · còn ${total - done - err}…`, 'working');
  });
  novaLog('━━━ ' + (window.__mvVidStop ? '■ Đã dừng' : '✔ Hoàn tất') + ' · ' + done + '/' + total + ' video' + (err ? ' · ' + err + ' lỗi' : '') + ' ━━━', done && !err ? 'ok' : (err ? 'warn' : 'acc'));
  window.__tvRunning = false; _mvVidSyncBtn(false);
  tvRenderVideos();
  setStatusBar('statusMvVid', window.__mvVidStop ? `Đã dừng. ${done} video.` : `✓ Xong ${done} video${err ? `, ${err} lỗi` : ''}.`, err ? 'error' : 'ok');
}

// === L?: function tvDownloadOne ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=203c, shared=192c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function tvDownloadOne(i){ const r = tvResults[i]; if (!r) return; if (r.b64) _mvDownload(_b64ToBlob(r.b64, r.mime), r.name + '.mp4'); else if (r.videoUrl) window.open(r.videoUrl, '_blank'); }

// === L?: let tvModelKeys ===
let tvModelKeys = {};

// === L?: const TV_MODEL_LABEL ===
const TV_MODEL_LABEL = { 'omni-flash': 'Omni Flash', 'veo31-lite': 'Veo 3.1 Lite', 'veo31-fast': 'Veo 3.1 Fast', 'veo31-quality': 'Veo 3.1 Quality' };

// === TOOL 6 (VEO Shot Forge) — khôi phục 2026-09-10 ===
// 5 const + 1 let từng bị strip trong refactor 2026-09-09 nhưng veoInit() ở index.html L5722 vẫn tham chiếu.
// Trong renderer const/let top-level KHÔNG vào globalThis → dùng var để veoInit() thấy được.
var VEO_SHOT_TYPES = {
  ESTABLISHING:{ key:"ESTABLISHING", label:"Establishing", vi:"Toàn cảnh",
    camera:"Epic wide establishing shot — either a STATIC locked-off frame OR ONE slow lateral drift; the subject is dwarfed by a vast environment to emphasize scale (never zoom, never pull back)", color:"#5B8DEF" },
  STATIC:{ key:"STATIC", label:"Static", vi:"Tĩnh (tripod)",
    camera:"STATIC locked-off tripod shot — camera perfectly still; only the subject and the environment move inside the frame (wind, dust, water). No camera movement at all", color:"#8A8F98" },
  WIDE:{ key:"WIDE", label:"Wide", vi:"Góc rộng",
    camera:"Wide shot, subject small within a large environment to emphasize scale — STATIC locked-off, OR ONE slow lateral tracking / cinematic pan for parallax depth (never zoom, never pull back)", color:"#46A0E0" },
  MEDIUM:{ key:"MEDIUM", label:"Medium", vi:"Góc trung",
    camera:"Medium shot from roughly mid-body up — STATIC, OR ONE slow gentle push-in (dolly-in). Never pull back", color:"#2FA88E" },
  ACTION:{ key:"ACTION", label:"Action", vi:"Hành động",
    camera:"ONE slow lateral tracking shot following the subject (single move, no pan or zoom), low angle for scale", color:"#E8A33D" },
  CLOSEUP:{ key:"CLOSEUP", label:"Close-up", vi:"Cận cảnh",
    camera:"ONE slow push-in / gentle dolly-in close-up, shallow depth of field (single move, never pull back)", color:"#A878E8" },
  CUTAWAY:{ key:"CUTAWAY", label:"Cutaway / B-roll", vi:"Cảnh phụ",
    camera:"STATIC, OR ONE slow pan across the environment — atmospheric b-roll, no main subject; the environment itself is the star", color:"#4FB286" },
};
var VEO_ROTATIONS = {
  wideMedium: ["WIDE","STATIC","MEDIUM","WIDE","CUTAWAY","MEDIUM","STATIC"],
  staticDoc:  ["STATIC","WIDE","STATIC","MEDIUM","CUTAWAY","STATIC","WIDE"],
  balanced:   ["ACTION","MEDIUM","CLOSEUP","CUTAWAY","STATIC"],
  closeup:    ["CLOSEUP","MEDIUM","CLOSEUP","ACTION","CUTAWAY"],
};
var VEO_ROTATION = VEO_ROTATIONS.wideMedium;
var VEO_STYLE_PRESETS = {
  paleorealism:{ label:"Paleorealism (Ice Age / wildlife)", baseStyle:"In the style of a BBC Earth photorealistic wildlife documentary,", motionGuard:"slow, deliberate, weighty motion — never modern-animal speed" },
  cosmic:{ label:"Cosmic / space documentary", baseStyle:"In the style of a NASA-grade photorealistic deep-space documentary,", motionGuard:"near-still cosmic drift, immense scale, slow parallax — never fast or jittery" },
  cinematicDoc:{ label:"Generic cinematic documentary", baseStyle:"In the style of a premium photorealistic cinematic documentary,", motionGuard:"smooth, slow, deliberate camera and subject motion" },
};
var veoUI = { mode:"script", shots:[], busy:false, stop:false };

// === L?: const TV_BUILTIN_MODEL_KEYS ===
const TV_BUILTIN_MODEL_KEYS = { 'omni-flash': 'abra_t2v_8s', 'veo31-fast': 'veo_3_1_t2v_fast', 'veo31-lite': 'veo_3_1_t2v_lite', 'veo31-quality': 'veo_3_1_t2v' };

async function tvLoadModelKeys(){ try { const r = await flowBridge.call('VIDEO_MODEL_STATUS'); tvModelKeys = (r && r.modelKeys) || {}; } catch (e){} }

// === L?: function tvOnModelChange ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=218c, shared=194c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function tvOnModelChange(){ const m = document.getElementById('mvVidModel')?.value || ''; const w = document.getElementById('tvDurWrap'); if (w) w.style.display = /^veo/.test(m) ? 'none' : ''; }

async function mvVideoDownloadAll(){
  const rows = tvResults.filter(r => r.status === 'done' && (r.b64 || r.videoUrl));
  if (!rows.length){ setStatusBar('statusMvVid', 'Chưa có video nào để tải.', 'info'); return; }
  for (const r of rows){
    if (r.b64){ _mvDownload(_b64ToBlob(r.b64, r.mime), r.name + '.mp4'); }
    else if (r.videoUrl){ window.open(r.videoUrl, '_blank'); }
    await new Promise(res => setTimeout(res, 450));   // giãn cách tránh trình duyệt chặn tải hàng loạt
  }
  setStatusBar('statusMvVid', `✓ Đã tải ${rows.length} video.`, 'ok');
}

// === L?: let _libTab ===
let _libTab = 'chars';

// === L?: const IDB ===
const IDB = {
  db: null,
  async open(){
    if (this.db) return this.db;
    return new Promise((res, rej) => {
      const r = indexedDB.open('AI Video Studio', 1);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
      };
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async set(key, value){
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(value, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  async get(key){
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('blobs', 'readonly');
      const req = tx.objectStore('blobs').get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },
  async del(key){
    const db = await this.open();
    return new Promise((res) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  }
};

// === L?: const _WD_LIGHT_KEYS ===
const _WD_LIGHT_KEYS = ['script', 'videoLogline', 'videoLoglineSig', 'thumbUrl', 'exportPath', 'videoMix', 'stockMix', 'ytMix', 'stockType', 'seo', 'seoTitle', 'descMode', 't3Era', 't3BgLayout', 'sceneTypesOn'];

// === L?: let _saveTimer ===
let _saveTimer;

// === L?: const PRESET ===
const PRESET = {
  characterStyleB: "Simple stick figure character, large round white circle head (pure white no fill), two small black dot eyes, simple curved smile, thin single black line body arms legs, minimal clothing suggestion with flat color fill, NO detailed features, hand-drawn cartoon style, professional white background",
  characterStyle: "2D cartoon character, bold thick black ink outlines, perfectly round WHITE circle head (pure white, NOT skin-colored), small simple black dot eyes, thin simple eyebrow lines, simple small curved mouth, body with detailed era-appropriate clothing (visible folds layers buttons collars), THIN single black line arms with small round black circle hands, THIN single black line legs ending in X-crossed feet, clothing has warm muted dark colors browns grays dark greens navy, flat color fills no gradients, hand-drawn cartoon style, professional white background",
  backgroundStyle: "2D cartoon background illustration, bold black outlines, detailed interior or exterior environment with depth and atmosphere, muted dark color palette browns grays dark greens warm shadows, visible furniture props architectural details environmental storytelling elements, cinematic moody lighting with warm practical light sources, flat color fills with subtle tone variation, hand-drawn illustration style, NO characters NO people NO figures NO text NO words, 16:9 ratio",
  sceneStyle: "simple 2D flat animation style, thick black outlines, round expressive eyes, simple hand-drawn aesthetic, warm muted color palette, educational explainer video style, no photorealism, flat colors"
};

// === L?: const STYLE_PRESETS ===
const STYLE_PRESETS = {
  '': { label: '— Chọn preset style —' },
  cartoon2d: {
    label: '🎨 Cartoon 2D (flat vector)',
    characterStyle: 'Flat 2D cartoon character drawn as a clean hand-drawn vector illustration. Bold, clean black outlines of even constant weight on every shape. Simple expressive face: two solid dot eyes, a small simple nose, bold eyebrows as the main emotion driver, and one curved expressive mouth. Simplified, slightly stylized body proportions (head a touch large), clear silhouette. Flat solid color fills with NO gradients and only light minimal cel-shading for form. Era- and role-appropriate clothing built from simple bold shapes and flat colors. Full-body front view, clean plain off-white background, soft contact shadow under the feet. Identical character design, proportions and palette in every pose and camera angle.',
    backgroundStyle: 'Flat 2D cartoon environment illustration matching the character style. Bold clean black outlines of even weight, clear foreground / midground / background depth, simple props and architecture drawn as flat bold shapes. Muted, harmonious color palette with soft flat cel-shading, NO gradients, hand-drawn vector aesthetic. Crisp clean linework, readable composition. NO characters NO people NO figures NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'simple flat 2D animation aesthetic, thick even black outlines, flat solid colors with light cel-shading, round expressive faces, warm muted harmonious palette, clean educational explainer-video look, NOT photorealistic, NOT 3D, NOT anime.',
    promptRules: 'No text, no captions, no watermark, no logos, no photorealism, no 3D shading, no gradients, no realistic skin/fabric/material texture, no painterly brushwork. Keep thick even black outlines on every element, flat color fills only, the SAME character design, proportions and colors across all scenes. No distorted anatomy, no extra fingers.',
    charIdentity: 'flat 2D cartoon, bold even black outline, dot eyes, flat solid colors, simple slightly-large-head proportions'
  },
  realistic: {
    label: '📷 Ảnh thực (photorealistic)',
    characterStyle: 'Photorealistic real human. Natural skin with realistic texture, pores and subtle imperfections; realistic hair rendered strand by strand; anatomically accurate human proportions and hands (five correct fingers). Age-, gender- and role-appropriate detailed clothing with real fabric texture, weight and natural folds. Soft natural three-point studio lighting, sharp focus, shot on a full-frame camera with a 50mm lens, shallow depth of field, professional portrait photography, neutral grey seamless backdrop. The SAME recognizable face, hairstyle and build kept consistent in every shot.',
    backgroundStyle: 'Photorealistic real-world environment. Physically accurate materials and surface textures, correct perspective and depth, natural or practical lighting with realistic soft shadows, reflections and bounce light, cinematic color grading, high dynamic range, ultra-detailed, shot on a wide cinematic lens with subtle depth of field. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'photorealistic cinematic photography, natural realistic lighting, true-to-life materials and textures, sharp focus with shallow depth of field, subtle film grain, professional color grading, real-world look.',
    promptRules: 'No text, no captions, no watermark, no logos. No cartoon / illustration / anime / 3D-render / painterly look. No plastic or waxy skin, no distorted anatomy, no extra or missing fingers, no warped faces or limbs. Keep the SAME person\'s facial identity, hairstyle and body consistent across all scenes.',
    charIdentity: 'same real person, consistent photoreal face and hairstyle, natural skin with pores, realistic human proportions'
  },
  anime: {
    label: '🌸 Anime / Manga',
    characterStyle: 'Anime / manga character with clean crisp cel-shaded coloring (2–3 flat shadow tones, sharp shadow edges). Large expressive eyes with bright catchlights, detailed stylized hair built from distinct strand clusters, slim stylized anime proportions, sharp confident clean lineart of varied weight. Vibrant yet harmonious saturated colors, detailed era- and role-appropriate costume. Full-body front view, plain white background, soft shadow under the feet. Identical character design, hairstyle, eye shape and outfit in every pose.',
    backgroundStyle: 'Anime background art: detailed semi-painterly environment, soft gradient skies, atmospheric depth with light rays and bloom, cel-shaded lighting with warm/cool contrast, vibrant saturated but harmonious colors, clean edges, studio-anime feature-film quality. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'anime cel-shaded aesthetic, clean confident lineart, vibrant saturated colors, expressive dramatic lighting, detailed semi-painterly backgrounds, Japanese animation feature-film look.',
    promptRules: 'No text, no captions, no watermark, no logos. No photorealism, no 3D render, no Western-cartoon look. Keep the clean cel-shaded anime style and the SAME character design, hairstyle and outfit across all scenes. No distorted anatomy, no extra fingers.',
    charIdentity: 'anime cel-shaded, large expressive eyes with catchlights, clean lineart, consistent stylized hair and outfit'
  },
  render3d: {
    label: '🧊 3D Render (Pixar-like)',
    characterStyle: '3D rendered character in a stylized Pixar / DreamWorks animation look. Appealing stylized proportions (slightly large head, expressive eyes), smooth subsurface-scattering skin, soft rounded sculpted forms, detailed textured clothing with believable physically-based material shading. Lit with soft global illumination, subtle ambient occlusion in the creases and a gentle rim light. Clean studio render, neutral seamless background, gentle depth of field. The SAME character model, proportions and textures kept consistent across all shots.',
    backgroundStyle: '3D rendered environment in a stylized animated-film look. Props and architecture with smooth clean surfaces and physically-based materials, soft global illumination, ambient occlusion, gentle depth of field, warm cinematic key light with cool fill. High render quality. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'stylized 3D render, Pixar-like, soft global illumination, smooth surfaces, physically-based materials, cinematic lighting with ambient occlusion and gentle depth of field.',
    promptRules: 'No text, no captions, no watermark, no logos. No 2D flat look, no hand-drawn lineart, no photoreal human. Keep the SAME stylized 3D character model, proportions and textures consistent across all scenes. No distorted anatomy, no extra fingers.',
    charIdentity: 'stylized 3D Pixar-like model, smooth subsurface skin, soft rounded forms, consistent character model'
  },
  watercolor: {
    label: '🖌 Màu nước (watercolor)',
    characterStyle: 'Traditional watercolor-illustration character. Soft hand-painted washes layered wet-on-wet, visible cold-press paper texture, gentle bleeding pigment edges, loose expressive brushwork, delicate pencil-and-ink linework on top. Soft muted harmonious palette, airy light feel, white paper background. Recognizable, consistent character design, palette and silhouette kept the same in every pose.',
    backgroundStyle: 'Watercolor painted environment: layered soft washes and blooming colors, visible cold-press paper grain, loose wet-on-wet brushwork, gentle muted harmonious palette, airy light atmosphere with soft feathered edges, delicate ink accents. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'traditional watercolor illustration, soft hand-painted layered washes, visible paper texture, loose expressive brushwork, gentle muted palette, soft bleeding edges, warm storybook feel.',
    promptRules: 'No text, no captions, no watermark, no logos. Keep the soft watercolor look with visible paper texture and bleeding edges; no hard digital edges, no photorealism, no 3D, no heavy black outlines. Keep the SAME character design and palette across all scenes.',
    charIdentity: 'watercolor washes, visible paper texture, loose brushwork, delicate ink lines, consistent muted palette'
  },
  lineart: {
    label: '✏️ Line art tối giản',
    characterStyle: 'Minimalist line-art character: clean single-weight black lines on pure white, minimal or no fill (at most one subtle accent color), simple confident geometric shapes, strong clear silhouette, generous negative space, modern editorial illustration. Full-body front view, white background. The SAME simple design and line weight kept consistent in every pose.',
    backgroundStyle: 'Minimalist line-art environment: clean thin even single-weight black lines on pure white, only the essential lines and props, generous negative space, modern editorial aesthetic, optional single subtle accent color. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'minimalist single-weight line art, clean thin black lines on white, lots of negative space, modern editorial look, minimal or no fill, at most one subtle accent color.',
    promptRules: 'No text, no captions, no watermark, no logos. Keep a minimalist clean even line weight; no heavy shading, no gradients, no color fills beyond one subtle accent, avoid clutter. Keep the SAME simple design across all scenes.',
    charIdentity: 'minimalist single-weight black line art on white, minimal fill, simple consistent geometric shapes'
  },
  lifestyle: {
    label: '🏡 Đời sống (ảnh thật sáng)',
    characterStyle: 'Photorealistic real person in a warm, bright lifestyle-photography look. Natural healthy skin with real texture, soft natural window light, relaxed candid expression and posture, casual modern everyday clothing with real fabric texture. Shot on a full-frame camera with a 35–50mm lens, shallow depth of field, clean bright exposure, gentle warm color grade. The SAME recognizable face, hairstyle and build kept consistent in every shot.',
    backgroundStyle: 'Bright, clean, real-world lifestyle environment (modern home, kitchen, café, outdoors) with warm natural daylight, soft shadows, tidy uncluttered composition, pleasant realistic materials and props, subtle bokeh, airy inviting mood. Cinematic but natural color grade, high detail. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'bright natural lifestyle photography, warm daylight, clean airy composition, shallow depth of field, realistic materials, gentle warm color grade, inviting real-world look.',
    promptRules: 'No text, no captions, no watermark, no logos. No cartoon / illustration / anime / 3D-render look. Keep bright natural lighting and realistic skin/materials; no plastic/waxy skin, no distorted anatomy, no extra fingers. Keep the SAME person consistent across scenes.',
    charIdentity: 'same real person, bright natural lifestyle photo, realistic skin and proportions, consistent face and hair'
  },
  infographic: {
    label: '📊 Mẹo vặt / Infographic phẳng',
    characterStyle: 'Simple flat vector character for an explainer / tips channel: clean even outlines (or outline-free flat shapes), friendly minimal face, simple rounded body, flat solid brand-like colors, modern flat-design illustration. Clear readable silhouette, full-body front view, plain light background. The SAME simple design, proportions and palette kept consistent in every scene.',
    backgroundStyle: 'Clean flat-design infographic environment: simple flat shapes, 1–2 clear icons or a simple diagram, generous negative space, a modern harmonious flat color palette (2–4 colors), soft or no shadows, tidy grid-like composition, crisp vector edges. NO photorealism. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'clean modern flat-design vector illustration, simple bold shapes, harmonious 2–4 color palette, generous negative space, crisp edges, friendly explainer / infographic look, flat minimal shading.',
    promptRules: 'No text, no captions, no watermark, no logos, no photorealism, no 3D, no gradients-heavy shading. Keep flat vector shapes, a consistent limited palette and the SAME simple character design across all scenes. Icons stay simple and iconic. No clutter.',
    charIdentity: 'flat vector explainer character, simple friendly shapes, flat solid colors, consistent limited palette',
    noChar: true
  },
  whiteboard: {
    label: '🖊 Whiteboard doodle',
    characterStyle: 'Hand-drawn whiteboard-doodle character: black marker line art on a pure white board, simple confident sketchy strokes, minimal or single-accent color fill, friendly simple face, clear silhouette, the look of a marker sketch. Full-body front view on white. The SAME simple doodle design and line weight kept consistent in every scene.',
    backgroundStyle: 'Whiteboard-doodle environment: black marker sketch lines on a clean white board, only the essential doodled props and simple scenery, lots of white space, optional single accent color, hand-drawn marker feel. NO characters NO people NO text NO words NO logos. 16:9 ratio.',
    sceneStyle: 'hand-drawn whiteboard marker doodle, black sketch lines on white, simple confident strokes, lots of white space, optional single accent color, friendly explainer look.',
    promptRules: 'No text, no captions, no watermark, no logos, no photorealism, no 3D, no heavy color. Keep black marker doodle lines on white with lots of negative space and a consistent simple hand-drawn look across all scenes.',
    charIdentity: 'whiteboard marker doodle, black sketch lines on white, simple consistent hand-drawn shapes',
    noChar: true
  }
};

// === L?: const _LANG_VOICE ===
const _LANG_VOICE = { 'Tiếng Việt':'vi', 'English':'en', '한국어 (Korean)':'ko', '日本語 (Japanese)':'ja', '中文 (Chinese)':'zh' };

// === L?: const _PF_ICONS ===
const _PF_ICONS = {
  char: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  bg: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M4 18l5-5 4 3 3-3 4 4"/>',
  scene: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/>',
  rule: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  script: '<path d="M14 3v5h5M8 13h8M8 17h5M6 3h9l5 5v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z"/>',
  thumb: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l4.5-4 3.5 2.5L16 11l4 4"/>',
};

async function tsAnalyzeCompetitor(files){
  const arr = Array.from(files || []); if (!arr.length) return;
  const p = getProfile(); if (!p){ alert('Chưa có Profile. Tạo Profile trước.'); return; }
  const st = document.getElementById('pScriptAnalyzeStatus');
  const setSt = (m, c) => { if (st){ st.textContent = m; st.style.color = c || 'var(--text-muted)'; } };
  setSt('Đang đọc ' + arr.length + ' file…', 'var(--violet)');
  // Đọc tối đa 6 file; cắt tổng ~48k ký tự để không tràn ngữ cảnh.
  const picked = arr.slice(0, 6);
  const perFile = Math.max(4000, Math.floor(48000 / picked.length));
  const texts = [];
  for (const f of picked){
    try { const t = await f.text(); if (t && t.trim()) texts.push({ name: f.name, text: t.trim().slice(0, perFile) }); } catch (e) {}
  }
  if (!texts.length){ setSt('Không đọc được nội dung (chọn file .txt).', 'var(--red)'); return; }
  const n = texts.length;
  setSt('🤖 AI đang phân tích ' + n + ' kịch bản (9 lớp → prompt 8 khối)…', 'var(--violet)');
  const joined = texts.map((x, i) => `━━━ KỊCH BẢN ${i + 1} (${x.name}) ━━━\n${x.text}`).join('\n\n');
  const prompt =
`Bạn là chuyên gia mổ xẻ kịch bản video faceless VIRAL và là người viết META-PROMPT cấp cao — bộ hướng dẫn cực chi tiết để một AI khác viết kịch bản MỚI cùng phong cách. Dưới đây là ${n} kịch bản mẫu THÀNH CÔNG của (các) kênh cùng thể loại.

${joined}

Làm theo 2 bước. CHỈ xuất ra kết quả Bước 2.

BƯỚC 1 — MỔ XẺ (làm trong đầu, ĐO BẰNG CON SỐ, KHÔNG xuất ra; một đặc điểm chỉ thành "luật" khi lặp ở ${n > 1 ? 'phần lớn ' + n + ' kịch bản' : 'kịch bản'}). Rút ra: thể loại & persona người viết; mục tiêu cảm xúc; NGÔI kể + THÌ; ngôn ngữ. Khung: số phần/chương, TỈ LỆ % cho mở/thân/kết (dùng %, không chốt số từ). Hook: 2-3 câu đầu làm gì, dạng mở, độ dài câu đầu, có nêu năm không. Beat thân: công thức lặp mỗi khối + cách chuyển cảnh vô hình. Giọng: độ dài câu trung bình, tần suất câu cụt, từ/cụm hay dùng, từ cấm, số câu hỏi tu từ. Cơ chế giữ chân: bí ẩn xương sống, open loop, object motif, reframe line, dramatic irony, sting line, micro-payoff. Đường cong năng lượng (2 trục) + vị trí đỉnh cảm xúc. Kết: dạng đóng, câu chốt. Guardrail: dùng số/tên/mốc thật & hedge ra sao.

BƯỚC 2 — VIẾT "PROMPT KỊCH BẢN": một META-PROMPT ĐẦY ĐỦ, CHI TIẾT, sẵn sàng dán cho AI khác viết kịch bản MỚI cùng phong cách viral này. Phần hướng dẫn tiếng Việt; ví dụ trích giữ nguyên ngôn ngữ gốc. Viết bằng CON SỐ/TỈ LỆ rút từ Bước 1, cụ thể tới mức đọc là viết được ngay. Gồm các khối đánh số:

1. ROLE — persona người viết + thể loại + mục tiêu cảm xúc (1 đoạn đậm chất, kiểu "Bạn là… Người xem KHÔNG học về X; người xem LÀ…").
2. OUTPUT — luật TTS tuyệt đối: CHỈ lời đọc liền mạch; ghi rõ NGÔI + THÌ đã rút ra; số & tiền VIẾT BẰNG CHỮ; cấm tiêu đề/nhãn/emoji/markdown/ký hiệu; chỉ dấu câu chuẩn.
3. ĐỘ DÀI & NGÂN SÁCH — Tổng ≈ {{WORDS}} từ (dùng ĐÚNG chuỗi {{WORDS}}, KHÔNG thay bằng số). Chia N phần theo TỈ LỆ % (vd hook ~13%, thân ~74%, kết ~13%); mỗi khối ghi % của tổng, KHÔNG ghi số từ cứng. Kèm luật chống teo: các khối cuối phải đủ ngân sách như khối đầu, đừng rút gọn để về đích sớm.
4. SKELETON / FORMAT ẨN — bộ beat của thể loại rải đều các phần; KHÔNG gọi tên beat/format trong lời đọc. Người xem chỉ được CẢM cấu trúc, không thấy bản đồ.
5. LENS — 4-6 góc nhìn để tránh mọi video giống nhau; nêu lens mặc định + lens "chỉ làm gia vị". (Thumbnail đã hét thay — lời dẫn không hét.)
6. ĐƯỜNG CONG NĂNG LƯỢNG — 2 trục ngược nhau hợp thể loại; đỉnh cảm xúc để dành gần cuối; luật CHỐNG SƯƠNG MÙ: mỗi phần phải đẩy thêm 1 điều MỚI, không chỉ tô lại không khí.
7. CƠ CHẾ GIỮ CHÂN — chỉ lấy cái hợp thể loại, mỗi cái kèm 1 câu cách làm: bí ẩn xương sống, quiet/hard open loop, OBJECT MOTIF (vật nhỏ cắm ở mở, quay lại ≥2 lần gồm gần kết), REFRAME LINE, NARRATIVE GAP/dramatic irony, STING LINE, micro-payoff.
8. HOOK — luật 15 giây đầu (câu đầu ≤ ~15 từ; không nêu năm; cấm "Imagine you are"); 1 open loop gieo ở hook, tái teasing 2-3 lần, trả ở kết; kèm HOOK-BANK 8-10 archetype xoay vòng (mỗi video một dạng khác), viết fresh, có mẫu ngắn lấy "feel".
9. GIỌNG & NHỊP — ngôi + thì; độ dài câu (số từ); xen câu cụt; phép lặp cú pháp (anaphora); giới hạn câu hỏi tu từ; bộ từ vựng đặc trưng.
10. CẤM — sáo ngữ mở đầu; câu dẫn báo hiệu chuyển đoạn ("little did you know"…); gọi khán giả; giảng đạo; kết ngọt; khoe của; ký hiệu khó đọc cho TTS.
11. DẪN CHỨNG & GUARDRAIL — dùng số/tên/mốc THẬT + so sánh đời thường; hedge thành thật; KHÔNG bịa tên–năm–số chính xác giả.
12. ENDING (anti-formula) — trình tự đóng bài + 3-5 dạng kết xoay vòng để không video nào kết giống nhau; câu chốt mẫu nếu có.
13. FEW-SHOT — 2-3 đoạn TRÍCH NGUYÊN VĂN ngắn từ kịch bản mẫu (hook, câu chuyển, câu kết) làm ví dụ mẫu mực.
14. SELF-CHECK — checklist tự rà thầm trước khi nộp (đủ {{WORDS}} từ theo tỉ lệ? đúng ngôi/thì? hook đủ mạnh? object motif quay lại? sạch cho TTS? kết không lặp dạng?).

ĐẦU RA: Trả về DUY NHẤT nội dung "PROMPT KỊCH BẢN" (các khối đánh số), KHÔNG in lại Bước 1, KHÔNG lời dẫn thừa. BẮT BUỘC giữ nguyên văn chuỗi {{WORDS}} ở khối 3 và 14 để công cụ tự điền số từ — TUYỆT ĐỐI KHÔNG thay {{WORDS}} bằng con số.`;
  try {
    const raw = await callLLM(prompt, { maxTokens: 8000 });
    p.scriptPrompt = _tsCleanPrompt(raw);
    if (typeof saveState === 'function') saveState(true);
    renderProfileStyles();
    if (typeof setStatus1 === 'function') setStatus1('✓ Đã phân tích ' + n + ' kịch bản → tạo Prompt kịch bản viral (9 lớp → 8 khối).' + (n < 3 ? ' 💡 Nên gửi ≥3 kịch bản để rút "luật" chuẩn hơn.' : ''), 'ok');
  } catch (e){ setSt('Lỗi phân tích: ' + (e.message || e), 'var(--red)'); }
}

async function analyzeStyleImages(){
  if (!state.styleRefImages.length) return alert('Cần upload ít nhất 1 ảnh mẫu.');
  const status = document.getElementById('styleAnalysisStatus');
  status.innerHTML = '<span class="spinner"></span> <span style="color:var(--violet)">AI đang phân tích style từ ' + state.styleRefImages.length + ' ảnh...</span>';
  document.getElementById('btnAnalyzeStyle').disabled = true;

  try {
    const content = [];
    for (const img of state.styleRefImages.slice(0, 4)) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } });
    }
    content.push({
      type: 'text',
      text: `Phân tích KỸ visual style của ${state.styleRefImages.length} ảnh mẫu trên (ảnh từ 1 kênh video/animation faceless). Mục tiêu: viết "STYLE GUIDE" CỰC CHI TIẾT để mọi ảnh tạo sau giữ đúng phong cách & nhất quán. TUYỆT ĐỐI KHÔNG viết sơ sài, KHÔNG viết 1 đoạn ngắn chung chung.

Trả về CHÍNH XÁC 1 JSON object (không markdown, không chữ nào ngoài JSON). MỌI giá trị viết bằng TIẾNG ANH cho G-Labs, dùng \\n để xuống dòng giữa các mục:
{
  "characterStyle": "RẤT CHI TIẾT 200-350 từ, NHIỀU ĐOẠN chia mục rõ. Câu mở đầu chốt phong cách tổng (vd 'A minimalist stick-limb storybook character, hand-drawn with...'). Sau đó tả theo mục:\\n#1 BODY & PROPORTIONS: hình dạng & tỉ lệ đầu, tỉ lệ đầu/thân, cổ-tay-chân (nét stick mảnh hay chi thật, có cơ/khớp không), bàn tay (mitten/ngón), bàn chân.\\n#2 FACE: màu mặt/da, kiểu mắt (chấm/oval/có tròng/lông mi), mũi, miệng, lông mày, biểu cảm mặc định.\\n#3 HAIR & CLOTHING: kiểu tóc & cách xử lý, cách trang phục bám theo bối cảnh/thời đại.\\nNÊU RÕ nét vẽ: độ dày outline, kiểu cel-shading, có/không grain. Chốt phong cách bằng câu KHẲNG ĐỊNH rõ ràng, DƯƠNG TÍNH (vd 'flat 2D hand-drawn cartoon, cel-shaded, grounded human proportions with slim rounded limbs') — HẠN CHẾ 'NOT/no' (Nano Banana là model instruction-following, không dùng negative kiểu SDXL); nếu cần chỉ thêm tối đa 1-2 điều tránh ngắn. Chỉ tả thứ THẬT SỰ thấy trong ảnh.",
  "backgroundStyle": "RẤT CHI TIẾT 150-300 từ, nhiều đoạn: độ dày & độ sắc outline, mức chi tiết môi trường SO với nhân vật, bảng màu cụ thể, kiểu cel-shading + nguồn sáng (hướng/màu/tương phản ấm-lạnh), phối cảnh & lớp chiều sâu (foreground/midground/background), chất liệu & texture (gỗ, đá, vải, kim loại, giấy...), loại props. Kết thúc: NO characters, NO people, NO figures, NO text, NO words, 16:9 ratio.",
  "sceneStyle": "60-120 từ: aesthetic tổng cho MỌI scene — kiểu vẽ, nét, bảng màu, cel-shading, tương phản sáng, mood/tông, khung 16:9, sự nhất quán xuyên suốt mọi cảnh.",
  "promptRules": "Danh sách NGẮN (tối đa ~8-12 cụm) — CHỦ YẾU khẳng định DƯƠNG TÍNH điều muốn GIỮ (đúng nét vẽ & độ dày outline, đúng tỉ lệ cơ thể, bảng màu ảnh, nhân vật nhất quán mọi cảnh), chỉ kèm vài điều tránh THẬT CẦN: no text, no watermark, no logo, no distorted anatomy, no extra fingers. KHÔNG viết negative list dài kiểu SDXL — Nano Banana là model instruction-following.",
  "visualStyle": "tên ngắn 2-5 từ cho style này"
}

QUAN TRỌNG: characterStyle & backgroundStyle PHẢI dài và chia mục như STYLE GUIDE THẬT (không phải 1 đoạn ngắn). Phân tích THỰC TẾ từ ảnh, KHÔNG bịa, KHÔNG suy đoán những gì không thấy.`
    });

    const data = await callLLMJson('', {
      maxTokens: 4000,
      messages: [{ role: 'user', content }],
      validate: d => d && typeof d === 'object' && !Array.isArray(d)
        && typeof d.characterStyle === 'string' && d.characterStyle.length > 250
        && typeof d.backgroundStyle === 'string' && d.backgroundStyle.length > 150
    });
    if (data.characterStyle) document.getElementById('pCharStyle').value = data.characterStyle;
    if (data.backgroundStyle) document.getElementById('pBgStyle').value = data.backgroundStyle;
    if (data.sceneStyle) document.getElementById('pSceneStyle').value = data.sceneStyle;
    if (data.promptRules) document.getElementById('pPromptRules').value = data.promptRules;
    if (data.visualStyle) document.getElementById('pVisualStyle').value = data.visualStyle;
    status.innerHTML = '<span style="color:var(--green)">✓ Đã phân tích xong. Kiểm tra rồi Lưu.</span>';
  } catch (e) {
    console.error(e);
    status.innerHTML = '<span style="color:var(--red)">Lỗi: ' + escapeHtml(e.message) + '</span>';
  }
  document.getElementById('btnAnalyzeStyle').disabled = false;
}

async function genStyleFromText(){
  const desc = (document.getElementById('pStyleDesc')?.value || '').trim();
  if (!desc) return alert('Gõ mô tả kênh trước (ngách + phong cách).');
  const status = document.getElementById('styleDescStatus');
  if (status) status.innerHTML = '<span class="spinner"></span> <span style="color:var(--violet)">AI đang viết style guide…</span>';
  const btn = document.getElementById('btnGenStyleText'); if (btn) btn.disabled = true;
  try {
    const prompt = `Bạn là art director cho kênh video faceless. Từ MÔ TẢ KÊNH dưới, viết STYLE GUIDE CHI TIẾT để MỌI ảnh tạo sau (qua AI ảnh Nano Banana / Imagen) giữ ĐÚNG phong cách & nhất quán.

MÔ TẢ KÊNH: "${desc}"

Trả về CHÍNH XÁC 1 JSON object (KHÔNG markdown, KHÔNG chữ nào ngoài JSON). MỌI giá trị viết TIẾNG ANH, dùng \\n để xuống dòng giữa các mục:
{
  "characterStyle": "150-300 từ, chia mục: BODY & PROPORTIONS, FACE, HAIR & CLOTHING, nét vẽ/chất liệu render. Diễn đạt DƯƠNG TÍNH (model instruction-following — HẠN CHẾ 'no/not'). Nếu là kênh ẢNH THẬT thì tả như nhiếp ảnh người thật; nếu hoạt hình thì tả nét vẽ. Nếu ngách KHÔNG có nhân vật người (cảnh vật/đồ vật/quy trình) thì tả chủ thể chính điển hình của ngách.",
  "backgroundStyle": "120-250 từ: bối cảnh/môi trường điển hình của ngách, mức chi tiết, bảng màu, ánh sáng (hướng/màu/tương phản), phối cảnh & chiều sâu, chất liệu/texture. Kết thúc: no characters, no people, no text, 16:9 ratio.",
  "sceneStyle": "40-90 từ NGẮN GỌN: aesthetic tổng cho MỌI cảnh — kiểu ảnh/vẽ, bảng màu, ánh sáng, mood, khung 16:9, nhất quán. (Đây là cụm tag sẽ dán CUỐI mọi prompt nên phải súc tích.)",
  "promptRules": "8-12 cụm, CHỦ YẾU dương tính (điều muốn GIỮ), chỉ kèm vài negative thật cần: no text, no watermark. KHÔNG viết negative list dài kiểu SDXL.",
  "visualStyle": "tên style ngắn 2-5 từ",
  "ngach": "ngách/niche ngắn gọn",
  "noPeople": true nếu ngách này HẦU NHƯ KHÔNG có nhân vật người (mẹo vặt, đồ vật, quy trình, infographic, cảnh vật, sản phẩm…), false nếu thường có người (kể chuyện, vlog người thật, nhân vật…)
}
Suy ĐÚNG ngành từ mô tả. KHÔNG bịa chi tiết trái với mô tả.`;
    const data = await callLLMJson(prompt, { maxTokens: 3500, validate: d => d && typeof d === 'object' && !Array.isArray(d) && typeof d.sceneStyle === 'string' && d.sceneStyle.length > 20 });
    if (data.characterStyle) document.getElementById('pCharStyle').value = data.characterStyle;
    if (data.backgroundStyle) document.getElementById('pBgStyle').value = data.backgroundStyle;
    if (data.sceneStyle) document.getElementById('pSceneStyle').value = data.sceneStyle;
    if (data.promptRules) document.getElementById('pPromptRules').value = data.promptRules;
    if (data.visualStyle) document.getElementById('pVisualStyle').value = data.visualStyle;
    if (data.ngach){ const e = document.getElementById('pNgach'); if (e && !e.value.trim()) e.value = data.ngach; }
    const _sp = document.getElementById('pStylePreset'); if (_sp) _sp.value = '';   // đã tùy biến → bỏ chọn preset
    // 🚫👤 Ngách không người → tự tick "Kênh không người".
    const _nc = document.getElementById('noCharMode');
    if (_nc && data.noPeople === true){ _nc.checked = true; try { syncTool2(); saveState(true); } catch (e) {} }
    if (status) status.innerHTML = '<span style="color:var(--green)">✓ Đã điền 4 ô style' + (data.noPeople === true ? ' + tự bật "Kênh không người"' : '') + '. Kiểm tra rồi Lưu.</span>';
  } catch (e){ console.error(e); if (status) status.innerHTML = '<span style="color:var(--red)">Lỗi: ' + escapeHtml(e.message || String(e)) + '</span>'; }
  if (btn) btn.disabled = false;
}

async function autoExtract(){
  const sg = document.getElementById('pStyleGuide').value;
  const dk = document.getElementById('pDnaKenh').value;
  const cd = document.getElementById('pChuDe').value;
  if (!sg && !dk && !cd) return alert('Cần paste ít nhất 1 tài liệu.');
  const status = document.getElementById('extractStatus');
  status.innerHTML = '<span class="spinner"></span> AI đang phân tích...';
  document.getElementById('btnAutoExtract').disabled = true;

  try {
    const prompt = `Đọc 3 tài liệu sau và trích xuất thông tin để điền profile kênh video.

=== STYLE GUIDE ===
${sg || '(không có)'}

=== DNA KÊNH ===
${dk || '(không có)'}

=== CHỦ ĐỀ ===
${cd || '(không có)'}

Trả về CHÍNH XÁC 1 JSON object (không markdown):
{
  "tenKenh": "tên kênh",
  "ngach": "ngách/niche",
  "visualStyle": "visual style preset",
  "ngonNgu": "ngôn ngữ VO",
  "povStyle": "kiểu POV",
  "cauTruc": "cấu trúc video",
  "soPhan": 8,
  "targetPhut": 12,
  "characterStyle": "prompt ảnh character reference, 80-120 từ tiếng Anh",
  "backgroundStyle": "prompt ảnh background reference, 80-120 từ tiếng Anh",
  "sceneStyle": "prompt ngắn 30-50 từ tiếng Anh cho scene aesthetic",
  "promptRules": "negative prompt rules"
}

Character/Background/Scene style prompts PHẢI bằng tiếng Anh.`;
    const data = await callLLMJson(prompt, {
      maxTokens: 3000,
      validate: d => d && typeof d === 'object' && !Array.isArray(d) && (d.tenKenh || d.ngach || d.characterStyle || d.visualStyle)
    });
    if (data.tenKenh) document.getElementById('pTenKenh').value = data.tenKenh;
    if (data.ngach) document.getElementById('pNgach').value = data.ngach;
    if (data.visualStyle) document.getElementById('pVisualStyle').value = data.visualStyle;
    if (data.ngonNgu) document.getElementById('pNgonNgu').value = data.ngonNgu;
    if (data.povStyle) document.getElementById('pPovStyle').value = data.povStyle;
    if (data.cauTruc) document.getElementById('pCauTruc').value = data.cauTruc;
    if (data.soPhan) document.getElementById('pSoPhan').value = data.soPhan;
    if (data.targetPhut) document.getElementById('pTargetPhut').value = data.targetPhut;
    if (data.characterStyle) document.getElementById('pCharStyle').value = data.characterStyle;
    if (data.backgroundStyle) document.getElementById('pBgStyle').value = data.backgroundStyle;
    if (data.sceneStyle) document.getElementById('pSceneStyle').value = data.sceneStyle;
    if (data.promptRules) document.getElementById('pPromptRules').value = data.promptRules;
    status.innerHTML = '<span style="color:var(--green)">✓ Đã điền tự động. Kiểm tra rồi Lưu.</span>';
  } catch (e) {
    console.error(e);
    status.innerHTML = '<span style="color:var(--red)">Lỗi: ' + escapeHtml(e.message) + '</span>';
  }
  document.getElementById('btnAutoExtract').disabled = false;
}

// === L?: const setStatusF ===
const setStatusF = (m, t) => setStatusBar('statusflow', m, t);

// === L?: const flowBridge ===
const flowBridge = {
  ready: false, version: null, _inited: false, _seq: 0,
  _pending: {}, _waiters: [],
  mode: (localStorage.getItem('tfAuthMode') || 'builtin'),   // 'builtin' | 'extension'
  // App desktop: Flow chạy NATIVE (không cần extension) qua window.native.flow.
  get _native(){ return (window.native && typeof window.native.flow === 'function') ? window.native.flow : null; },
  get _ext(){ return (window.native && typeof window.native.flowExt === 'function') ? window.native.flowExt : null; },
  setMode(m){ this.mode = (m === 'extension') ? 'extension' : 'builtin'; localStorage.setItem('tfAuthMode', this.mode); },
  _channel(){
    if (this.mode === 'extension' && this._ext) return this._ext;   // Chrome thật qua bridge
    if (this._native) return this._native;                          // trình duyệt nhúng
    return null;
  },
  init(){
    if (this._inited) return; this._inited = true;
    if (this._native || this._ext){ this.ready = true; this.version = 'native'; return; }   // app: sẵn sàng ngay
    window.addEventListener('message', (e) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.source !== 'FLOWGEN_EXT') return;
      if (d.type === 'READY'){ this.ready = true; this.version = d.version; this._waiters.forEach(fn => fn()); this._waiters = []; return; }
      if (d.id && this._pending[d.id]){
        const p = this._pending[d.id]; delete this._pending[d.id];
        p.resolve(d.ok ? d.result : { error: d.error || 'BRIDGE_ERROR' });
      }
    });
    this.ping();
  },
  ping(){ if (this._native || this._ext) return; window.postMessage({ source: 'FLOWGEN_PAGE', action: 'PING' }, window.location.origin); },
  waitReady(ms = 1500){
    if (this._native || this._ext) return Promise.resolve(true);   // app: luôn sẵn sàng
    return new Promise((res) => {
      if (this.ready) return res(true);
      const to = setTimeout(() => res(false), ms);
      this._waiters.push(() => { clearTimeout(to); res(true); });
      this.ping();
    });
  },
  call(action, payload){
    const ch = this._channel();
    if (ch) return ch(action, payload).catch(e => ({ error: (e && e.message) || 'NATIVE_ERROR' }));
    return new Promise((resolve) => {
      const id = 'f' + (++this._seq) + '_' + Date.now();
      this._pending[id] = { resolve };
      window.postMessage({ source: 'FLOWGEN_PAGE', id, action, payload }, window.location.origin);
      setTimeout(() => { if (this._pending[id]){ delete this._pending[id]; resolve({ error: 'TIMEOUT' }); } }, 600000);
    });
  }
};

// === L?: const tfState ===
const tfState = { running: false, stop: false, projectId: null, uploaded: {}, onProgress: null };

// === L?: let bulkState ===
let bulkState = { items: [], running: false, stop: false, refs: [] };

// === L?: let _tfBuiltinPoll ===
let _tfBuiltinPoll = null;

// === L?: let _tfCftBusy ===
let _tfCftBusy = false;

// === L?: let _fcTestId ===
let _fcTestId = null;

// === L?: var _capModeCache ===
var _capModeCache = 'guest';

// === L?: let _tfPersistKey ===
let _tfPersistKey = '';

// === L?: let _tfExtPoll ===
let _tfExtPoll = null;

// === L?: const setStatus1 ===
const setStatus1 = (m, t) => setStatusBar('status1', m, t);

// === L?: const setStatus2 ===
const setStatus2 = (m, t) => setStatusBar('status2', m, t);

async function splitScenesSmart(text, min, max){
  const paras = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const all = [];
  const batches = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > 2000 && cur) { batches.push(cur); cur = p; }
    else cur = cur ? cur + '\n\n' + p : p;
  }
  if (cur) batches.push(cur);
  clearCancel();
  const lanes = _concurrency();

  const buildPrompt = (batchText) => `Bạn là biên tập video. Chia đoạn kịch bản sau thành các cảnh cho sản xuất video ảnh.

QUY TẮC QUAN TRỌNG NHẤT — KHÔNG ĐƯỢC VI PHẠM:
- ĐƠN VỊ NHỎ NHẤT LÀ 1 CÂU HOÀN CHỈNH (kết thúc bằng . ! ? …).
- TUYỆT ĐỐI KHÔNG cắt 1 câu thành 2 cảnh — kể cả câu dài, kể cả có dấu phẩy "," hay gạch ngang "—" / ":" giữa câu.
- Việc của bạn là GỘP các câu thành cảnh, KHÔNG phải CẮT câu.

Quy tắc gộp:
- 1 câu dài → để NGUYÊN cả câu trong 1 cảnh (dù vượt ${max} ký tự — vẫn giữ nguyên).
- Nhiều câu ngắn cùng 1 ý hình ảnh → có thể gộp vào 1 cảnh (mục tiêu ${min}-${max} ký tự, nhưng ranh giới câu quan trọng hơn đếm ký tự).
- Câu ngắn ấn tượng (như "Ồ.", "Chờ đã.") có thể đứng riêng 1 cảnh.
- GIỮ NGUYÊN lời gốc 100% — chỉ quyết định chỗ gộp, không sửa chữ.

ĐỊNH DẠNG OUTPUT — BẮT BUỘC theo mẫu sau, mỗi cảnh trên dòng riêng, phân cách bằng dòng "===SCENE===":

===SCENE===
nội dung cảnh 1 ở đây
===SCENE===
nội dung cảnh 2 ở đây
===SCENE===
nội dung cảnh 3 ở đây

KHÔNG dùng JSON, KHÔNG ngoặc kép quanh cảnh, KHÔNG đánh số. CHỈ in các cảnh phân cách bằng "===SCENE===".

Đoạn kịch bản:
"""
${batchText}
"""`;
  const parse = (r) => {
    let ps = r.split(/===SCENE===/i).map(s => s.trim()).filter(Boolean);
    if (ps.length && ps[0].length < 80 && !/[.!?…]$/.test(ps[0])) ps = ps.slice(1); // bỏ preamble
    return ps;
  };
  // Hợp lệ khi: model CÓ dùng delimiter + tổng độ dài xấp xỉ kịch bản gốc (chống model trả suy luận/echo prompt)
  const valid = (r, ps, batchText) => {
    if (!ps.length || !/===SCENE===/i.test(r)) return false;
    const ratio = ps.join(' ').length / Math.max(1, batchText.length);
    return ratio >= 0.6 && ratio <= 1.6;
  };

  let doneCount = 0;
  // SONG SONG theo số luồng — các đoạn độc lập, runConcurrent trả kết quả theo ĐÚNG thứ tự
  const results = await runConcurrent(batches, async (batchText, bi) => {
    if (state.cancelRequested) return [];
    let parts;
    try {
      const prompt = buildPrompt(batchText);
      // Thinking OFF: tránh DeepSeek viết suy luận tràn vào output (định dạng ===SCENE===)
      let reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } });
      parts = parse(reply);
      if (!valid(reply, parts, batchText)) { reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } }); parts = parse(reply); }
      if (!valid(reply, parts, batchText)) {
        console.warn('Smart split đoạn ' + (bi + 1) + ' không hợp lệ → fallback regex');
        parts = splitScenesFast(batchText, min, max);
      }
    } catch (e) {
      console.warn('Smart split đoạn ' + (bi + 1) + ' lỗi → fallback regex:', e.message);
      parts = splitScenesFast(batchText, min, max);
    }
    // Chống "1 cảnh khổng lồ": model hay gộp cả đoạn thành 1 cảnh (thường gặp với tiếng Hàn/Nhật/Trung).
    // Cảnh nào dài bất thường → tách lại theo CÂU bằng bộ tách nhanh (xử lý được dấu . CJK).
    parts = parts.flatMap(pp => (pp && pp.length > max * 1.6) ? splitScenesFast(pp, min, max) : [pp]);
    doneCount++;
    setStatus2(`AI đang chia cảnh... ${doneCount}/${batches.length} phần${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
    return parts;
  }, lanes, () => state.cancelRequested);

  // Ghép theo thứ tự đoạn
  results.forEach(parts => { if (Array.isArray(parts)) all.push(...parts); });
  if (state.cancelRequested) { clearCancel(); setStatus2(`⏸ Đã dừng. Đã chia được ${all.length} cảnh.`, 'info'); }
  return all;
}

async function mergeScenesByMeaningAI(silent){
  if (!silent) syncTool2();
  if (!state.scenes || !state.scenes.length) { if (!silent) setStatus2('Chưa có cảnh để gộp.', 'error'); return; }
  if (state.scenes.length < 2) return;
  const hasWork = Object.keys(state.scenePrompts || {}).length || Object.keys(state.sceneImages || {}).length;
  if (!silent && hasWork && !confirm('Gộp theo ý sẽ đổi ranh giới cảnh → prompt/ảnh đã tạo sẽ bị xoá. Tiếp tục?')) return;

  const N = state.scenes.length;
  const maxChars = state.maxChars || 150;
  const list = state.scenes.map((s, i) => `${i + 1}. ${(s.text || '').replace(/\s+/g, ' ').trim()}`).join('\n');
  const prompt = `Dưới đây là danh sách CẢNH đã đánh số (mỗi dòng 1 cảnh, là 1 câu).
Nhiệm vụ: GỘP các cảnh LIÊN TIẾP thuộc CÙNG 1 Ý HÌNH ẢNH (vẽ được chung 1 khung hình) vào 1 nhóm, để bớt vụn.

QUY TẮC BẮT BUỘC:
- CHỈ gộp các cảnh LIÊN TIẾP. TUYỆT ĐỐI KHÔNG cắt, KHÔNG đổi thứ tự, KHÔNG bỏ sót cảnh nào.
- 1 ý/đối tượng/khoảnh khắc = 1 nhóm. Câu mô tả tiếp cùng 1 cảnh → gộp chung. Sang ý mới → nhóm mới.
- ĐỪNG gộp quá to: mỗi nhóm tối đa ~3 câu hoặc ~${maxChars} ký tự.
- Câu đã đủ 1 ý rõ → để riêng 1 nhóm.

Trả về JSON array các nhóm, mỗi nhóm là mảng SỐ THỨ TỰ cảnh. MỖI số từ 1 đến ${N} xuất hiện ĐÚNG 1 LẦN, đúng thứ tự tăng dần.
VD: [[1],[2,3],[4],[5,6,7]]
CHỈ in JSON, không giải thích.

DANH SÁCH (${N} cảnh):
${list}`;

  try {
    if (!silent) setStatus2('AI đang gộp cảnh theo ý...', 'working');
    // callLLMJson: lặp + ép JSON + chỉ nhận nhóm phủ ĐÚNG 1..N, mỗi số 1 lần, đúng thứ tự
    let groups;
    try {
      groups = await callLLMJson(prompt, {
        maxTokens: Math.min(8000, 1500 + N * 12),
        validate: g => { const f = Array.isArray(g) ? g.flat() : []; return Array.isArray(g) && f.length === N && f.every((n, i) => n === i + 1); }
      });
    } catch (e) {
      console.warn('Gộp theo ý: nhóm không hợp lệ → giữ nguyên.', e.message);
      if (!silent) setStatus2('⚠️ AI gộp ý không hợp lệ → giữ nguyên cảnh.', 'info');
      return;
    }
    const out = groups.map(g => {
      const items = g.map(n => state.scenes[n - 1]);
      const base = { ...items[0] };
      base.text = items.map(s => (s.text || '').trim()).join(' ').replace(/\s+/g, ' ').trim();
      base.duration = items.reduce((a, s) => a + (parseFloat(s.duration) || 0), 0);
      base.character = (items.find(s => s.character) || {}).character || '';
      base.background = (items.find(s => s.background) || {}).background || '';
      return base;
    });
    const before = N;
    state.scenes = out;
    state.scenes.forEach((s, i) => { s.id = String(i + 1).padStart(3, '0'); s.duration = +(parseFloat(s.duration) || calcDur(s.text)).toFixed(1); });
    state.scenePrompts = {}; state.scenePrompts2 = {}; state.veoPrompts = {}; state.sceneImages = {}; state.sceneImagesB = {}; state.sceneVideos = {};
    renderAllT2();
    if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
    saveState();
    if (!silent) setStatus2(`✓ Gộp theo ý (AI): ${before} → ${state.scenes.length} cảnh.`, 'ok');
  } catch (e) {
    console.error(e);
    if (!silent) setStatus2('Lỗi gộp theo ý: ' + e.message, 'error');
  }
}

// === L?: const SCENE_TYPES ===
const SCENE_TYPES = {
  hook:         { core:true,  color:'#dc2626', vi:'mở đầu gây tò mò/sốc',        recipe:'an extreme close-up or an unusual dramatic angle, high contrast, dark moody lighting, a sense of tension or an unanswered question', motion:'punch' },
  establishing: { core:true,  color:'#2563eb', vi:'cảnh rộng mở bối cảnh/chương', recipe:'a wide establishing shot showing the whole environment, orienting light that sets the place and time of day', motion:'zoom-in' },
  scene:        { core:true,  color:'#64748b', vi:'kể chuyện thường (mặc định)',  recipe:'a medium shot with natural narrative framing', motion:'' },
  'close-up':   { core:true,  color:'#ea580c', vi:'cận nhấn cảm xúc/chi tiết',    recipe:'a macro close-up with shallow depth of field, focused on one emotional detail (hands, eyes, a key object)', motion:'zoom-in' },
  'b-roll':     { core:true,  color:'#0d9488', vi:'minh hoạ không nhân vật',      recipe:'illustrative b-roll of scenery, objects or textures with no people in frame', motion:'pan-right' },
  compare:      { core:false, color:'#b45309', vi:'giải thích/so sánh/số liệu',   recipe:'a clean, minimal side-by-side comparison or simple infographic on a plain white background — mostly ICONS, simple shapes and bars with LOTS of empty space; use text VERY SPARINGLY: at most a short 2-4 word title plus a few KEY numbers or 1-2 word labels (spelled correctly, matching the narration). NO sentences, NO paragraphs, NO long descriptive labels, NO cluttered wall of words — keep it clean and mostly visual', motion:'static' },
  flashback:    { core:false, color:'#7c3aed', vi:'hồi tưởng/quá khứ',            recipe:'a memory tone — desaturated sepia palette, soft vignette, heavier film grain to mark the past', motion:'zoom-in' },
  dream:        { core:false, color:'#0891b2', vi:'tưởng tượng/giả định',         recipe:'a surreal dreamlike look with soft glow and an ethereal palette', motion:'zoom-out' },
  map:          { core:false, color:'#65a30d', vi:'bản đồ/địa lý/di chuyển',      recipe:'an illustrated map or geographic view with routes and location markers, WITH short real place-name labels written on it (1-3 words each, spelled correctly)', motion:'pan-left' },
  reveal:       { core:false, color:'#9333ea', vi:'lật mở/before-after/twist',    recipe:'a dramatic reveal using a split or before-and-after composition with strong contrast', motion:'punch' },
  transition:   { core:false, color:'#94a3b8', vi:'chuyển chương/tiêu đề phần',   recipe:'a minimal transitional shot with negative space and subtle motion', motion:'static' },
};

// === L?: const SCENE_TYPES_CORE ===
const SCENE_TYPES_CORE = Object.keys(SCENE_TYPES).filter(k => SCENE_TYPES[k].core);

// === L?: function _t2SceneWarns ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1844c, shared=1611c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _t2SceneWarns(s, idx, scenes){
  const w = [];
  const txt = String(s.text || '').trim();
  const pr  = (state.scenePrompts || {})[s.id] || '';
  if (!pr.trim()) w.push('chưa có prompt ảnh');
  // Lời đọc có người hành động mà cảnh không gán nhân vật → thường là AI nhận diện hụt
  if (!String(s.character || '').trim() && /\b(he|she|they|his|her|người|anh|cô|ông|bà|họ)\b/i.test(txt) && s.shot !== 'b-roll')
    w.push('lời đọc có người nhưng cảnh không gán nhân vật');
  if (!String(s.background || '').trim() && !_isInfographicShot(s.shot)) w.push('chưa có bối cảnh');
  const d = +s.duration || 0;
  if (d && d < 1.2) w.push('cảnh quá ngắn (' + d.toFixed(1) + 's)');
  // Cảnh dài bất thường so với lượng chữ = căn timing hỏng. Trước đây lọt hết:
  // chỉ có cảnh báo quá NGẮN, nên cảnh 215 giây đi qua không ai biết.
  const uocD = Math.max(2, txt.length / 15);
  if (d > Math.max(20, uocD * 4)) w.push('cảnh quá dài (' + d.toFixed(0) + 's, chữ chỉ đủ ~' + Math.round(uocD) + 's) — căn timing có thể sai');
  // 4+ cảnh liên tiếp cùng một nhân vật → đơn điệu
  if (String(s.character || '').trim() && idx >= 3){
    const same = [1, 2, 3].every(k => (scenes[idx - k] || {}).character === s.character);
    if (same) w.push('4+ cảnh liên tiếp cùng nhân vật — nên xen cảnh b-roll');
  }
  // Prompt gần giống cảnh liền trước → hai ảnh sẽ na ná nhau
  if (pr && idx > 0){
    const prev = (state.scenePrompts || {})[scenes[idx - 1].id] || '';
    if (prev && prev.length > 40 && pr.slice(0, 90) === prev.slice(0, 90)) w.push('prompt gần trùng cảnh trước');
  }
  return w;
}

// === L?: const _t2Gist ===
const _t2Gist = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n || 90);

// === L?: const _T2_LUONG_MAC_DINH ===
const _T2_LUONG_MAC_DINH = 3;

// === L?: const _T2_NGUON_DS ===
const _T2_NGUON_DS = [
  { id: 'veo',   ten: 'Video Veo AI',  icon: '🎬', mo: 'Cảnh cần chuyển động thật, có nhân vật. Tốn credit Flow.' },
  { id: 'stock', ten: 'Video stock',   icon: '🎞', mo: 'Pexels + Pixabay. Cảnh đời thực, b-roll không nhân vật.' },
  { id: 'yt',    ten: 'Clip YouTube',  icon: '▶️', mo: '⚠️ Nội dung có bản quyền — rủi ro Content ID khi bật kiếm tiền.' },
  { id: 'kho',   ten: 'Kho mở',        icon: '🏛', mo: 'Wikimedia · NASA · Openverse · Archive.org. Giấy phép rõ, đã lọc bỏ NC/ND.' },
  { id: 'web',   ten: 'Nguồn web',     icon: '🌐', mo: '55 nền tảng — kho ảnh/video sẵn (Pexels, Pixabay, NASA, Openverse…), YouTube, Archive.org, C-SPAN, BBC… Bấm ⚙ để chọn nền tảng nào được dùng.',
    moAi: 'Tư liệu quay thật đã công bố: phiên điều trần, sự kiện lịch sử, phóng sự hiện trường, phim lưu trữ.' },
];

// === L?: const _T2_NGUON_HIEN ===
const _T2_NGUON_HIEN = ['veo', 'web'];

async function _t2ChonNguonChoCanh(scenes){
  const b = _t2NguonBat();
  const bat = _T2_NGUON_DS.filter(n => b[n.id]);
  scenes.forEach(s => { s.wantVideo = false; s.wantStock = false; s.wantYt = false; s.wantKho = false; s.wantWeb = false; s.nguonVi = ''; });
  if (!bat.length || scenes.length < 2) return { doi: 0 };

  const topic = String(state.videoLogline || '').trim();
  // Dùng moAi khi có: chữ trên nút là hướng dẫn bấm nút, đưa vào prompt chỉ tổ nhiễu.
  const bang = bat.map(n => {
    let d = n.moAi || n.mo;
    if (n.id === 'web' && typeof _webDangBat === 'function'){
      const ds = _webDangBat();
      if (ds.length) d += ' Nền tảng đang bật: ' + ds.slice(0, 8).map(p => p.ten).join(', ') + (ds.length > 8 ? '…' : '') + '.';
    }
    return `- ${n.id} (${n.ten}): ${d}`;
  }).join('\n');
  // Trần: ảnh AI phải giữ vai trò xương sống, không để nguồn ngoài chiếm hết.
  /* Trần cũ cứng 35% vì ảnh AI là mặc định. Nhưng khi bước chia cảnh đã đánh
     dấu phần lớn cảnh là TƯ LIỆU CÓ THẬT thì giữ 35% là ép hai phần ba số cảnh
     quay lại ảnh AI — ngược hẳn ý đồ. Nên trần bám theo chính số cảnh được
     đánh dấu, chặn trên 80% để ảnh AI vẫn còn chỗ cho cảnh trừu tượng.       */
  const _soThuc = scenes.filter(s => s.thuc).length;
  /* Người dùng kéo thanh tỉ lệ thì lấy đúng số đó và trần thành CỨNG —
     kể cả cảnh đánh dấu tư liệu thật cũng không vượt, nếu không thì kéo
     thanh xuống 20% vẫn ra 70% cảnh dùng nguồn ngoài.                      */
  const _tay = (typeof _t2TiLeNgoai === 'function') ? _t2TiLeNgoai() : null;
  /* SÀN 0,35 là di tích: con số 35% ban đầu là TRẦN ("nhiều nhất 35% dùng
     nguồn ngoài"), lúc đổi công thức sang bám `thuc` thì nó bị giữ lại thành
     SÀN — nghĩa ngược hẳn. Hậu quả đo được: bước chia cảnh đánh dấu 15% cảnh
     là tư liệu thật, công thức vẫn ép lên 35%. Hơn hai mươi phần trăm số cảnh
     bị giao nguồn ngoài dù AI đã nói chúng không có gì quay được — tìm thì
     trắng tay, mà tìm được thì cũng lệch nội dung.

     Nay TIN vào bước chia cảnh. Vẫn giữ tối thiểu 2 cảnh ở dưới để bật nguồn
     mà không ra clip nào thì trông như hỏng, và giữ trần 0,8 để ảnh AI còn
     chỗ. Muốn nhiều hơn thì kéo thanh tỉ lệ — đó mới là chỗ người dùng quyết. */
  const _tiLe = (_tay !== null)
    ? _tay / 100
    : Math.min(0.8, _soThuc / Math.max(1, scenes.length));
  const _cung = _tay !== null;
  const tran = _cung
    ? Math.round(scenes.length * _tiLe)          // tay: theo đúng thanh, cho phép cả 0
    : Math.max(2, Math.round(scenes.length * _tiLe));
  if (!_cung && typeof novaLog === 'function'){
    const _pc = Math.round(_soThuc / Math.max(1, scenes.length) * 100);
    novaLog(`🎯 Bước chia cảnh đánh dấu ${_soThuc}/${scenes.length} cảnh (${_pc}%) là tư liệu thật → trần ${tran} cảnh.`
      + (_pc < 12 ? ' Kịch bản thiên về trừu tượng — muốn nhiều tư liệu hơn thì kéo thanh Tỉ lệ nguồn.' : ''), 'info');
  }
  if (_cung && tran <= 0) return { doi: 0, tran: 0 };   // kéo về 0% = toàn ảnh AI, khỏi gọi AI
  const CH = 40;
  let doi = 0;
  const co = { veo: 'wantVideo', stock: 'wantStock', yt: 'wantYt', kho: 'wantKho', web: 'wantWeb' };

  /* Trước đây các lô chạy TUẦN TỰ: 267 cảnh = 7 lô = 7 lượt gọi AI nối đuôi.
     Lượt gọi từng lô vốn ĐỘC LẬP — chỉ bước ÁP KẾT QUẢ mới dùng chung biến
     đếm `doi` để chặn trần. Nên tách đôi: gọi AI song song, rồi áp kết quả
     TUẦN TỰ theo đúng thứ tự lô. Kết quả giống hệt bản cũ, chỉ nhanh hơn.  */
  const _lots = [];
  for (let i = 0; i < scenes.length; i += CH) _lots.push(scenes.slice(i, i + CH));

  const _kq = await _t2SongSong(_lots, _concurrency(), async (lot) => {
    const list = lot.map((s, k) => `${k}. [${s.shot || '?'}${s.character ? ' · có nhân vật' : ''}${s.thuc ? ' · TƯ LIỆU THẬT' : ''}] ${_t2Gist(s.text, 90)}`).join('\n');
    const prompt = `Chọn NGUỒN HÌNH cho từng cảnh của video.
${topic ? 'CHỦ ĐỀ: ' + topic + '\n' : ''}
Cảnh có nhãn "TƯ LIỆU THẬT" là cảnh bước chia đã xác định tả thứ CÓ THẬT ĐÃ ĐƯỢC QUAY —
ƯU TIÊN giao những cảnh đó cho nguồn tư liệu. Cảnh không có nhãn thì giữ ảnh AI, trừ khi rõ ràng hợp hơn.
Cả lô này nên chuyển khoảng ${Math.max(1, Math.round(lot.length * _tiLe))} cảnh.

NGUỒN ĐANG BẬT:
${bang}

LUẬT:
- Cảnh có NHÂN VẬT của video (người kể, nhân vật vẽ) → giữ ảnh AI, đừng dùng stock/kho: mặt người thật không khớp.
- Cảnh b-roll đời thực (bầu trời, biển, thành phố, máy móc) → stock.
- Cảnh cần TƯ LIỆU THẬT (hiện vật, bản đồ cổ, ảnh lưu trữ, thiên văn) → kho.
- Cảnh cần chuyển động mạnh và phải khớp nhân vật → veo.
- Cảnh cần TƯ LIỆU CÓ THẬT ĐÃ QUAY (phiên điều trần, sự kiện lịch sử, phóng sự,
  cảnh quay hiện trường, tư liệu lưu trữ có chuyển động) → web.
- Cảnh trừu tượng, ẩn dụ, nội tâm → giữ ảnh AI.

CẢNH:
${list}

Trả JSON, CHỈ những cảnh đổi nguồn:
[{"i":0,"nguon":"stock","why":"lý do ngắn tiếng Việt dưới 14 từ"}]`;

    for (let t = 0; t < 2; t++){
      try { const a = await callLLMJson(prompt, { maxTokens: 1100, validate: (d) => Array.isArray(d) }); if (a) return a; }
      catch (e){ /* thử lại một lần rồi bỏ lô */ }
    }
    return null;
  }, () => state.cancelRequested);

  // Áp kết quả THEO THỨ TỰ LÔ — biến đếm `doi` phải tăng tuần tự, chạy song
  // song ở đây là vượt trần.
  _lots.forEach((lot, li) => {
    const r = _kq[li];
    const arr = (r && r.ok) ? r.gt : null;
    if (!Array.isArray(arr)) return;
    arr.forEach(row => {
      const k = Number(row && row.i); const s = lot[Number.isFinite(k) ? k : -1]; if (!s) return;
      const ng = String(row.nguon || '').trim();
      if (!co[ng] || !b[ng]) return;                 // nguồn không bật thì bỏ
      // Hết trần thì chỉ còn nhận cảnh đã được đánh dấu tư liệu thật — cảnh
      // thường bị đẩy về ảnh AI, đúng thứ tự ưu tiên.
      if (doi >= tran && (_cung || !s.thuc)) return;
      s[co[ng]] = true; s.nguonVi = ng;
      s.nguonWhy = String(row.why || '').trim().slice(0, 70);
      doi++;
    });
  });

  return { doi, tran };
}

// === L?: const _T2_TAG_RE ===
const _T2_TAG_RE = /\[([^\[\]]+)\]/g;

async function _t2PlanWardrobe(script, noChar, presetEra){
  const eraLine = presetEra
    ? `THỜI ĐẠI/BỐI CẢNH đã cho — trang phục, đạo cụ, kiến trúc PHẢI đúng thời này: "${presetEra}". Trả lại y nguyên ở "era".`
    : `Tự SUY RA "era" = THỜI ĐẠI + BỐI CẢNH LỊCH SỬ của kịch bản (vd "Ancient Egypt, New Kingdom", "medieval Europe", "modern day USA", "1920s").`;
  const eraRule = 'Trang phục + kiểu tóc + đạo cụ PHẢI ĐÚNG THỜI ĐẠI đó — vd Ai Cập cổ đại: khố/áo choàng lanh, vòng cổ wesekh, tóc cạo/bộ tóc giả đen; TUYỆT ĐỐI không quần jeans/áo phông/đồ hiện đại nếu là thời cổ.';
  const prompt =
`Đọc kịch bản. ${eraLine}
Liệt kê CÁC NHÂN VẬT xuất hiện NHIỀU LẦN (bỏ vai thoáng qua). Với MỖI nhân vật lập TỦ ĐỒ. ${eraRule}
⚠️ QUAN TRỌNG: nếu kịch bản dùng NGÔI THỨ 2 ("you"/"bạn") và người đó ĐƯỢC HÌNH DUNG TRÊN MÀN HÌNH xuyên suốt (nhân vật đại diện người xem — vd người mua, khách hàng, người dùng, người xem) → PHẢI lập 1 slug cho họ (vd "shopper","viewer","protagonist") với 1 bộ đồ CỐ ĐỊNH, để mọi cảnh vẽ GIỐNG NHAU. ĐỪNG bỏ qua chỉ vì họ không có tên riêng — đây thường là NHÂN VẬT CHÍNH của video.
- "slug": tên ngắn cố định 1-3 từ, chữ thường gạch nối (vd "protagonist-male").
- "outfits": số bộ đồ = SỐ LẦN NHÂN VẬT THỰC SỰ ĐỔI QUẦN ÁO trong truyện, KHÔNG phải số địa điểm.
  ⚠️ MẶC ĐỊNH CHỈ 1 BỘ. Đi nhiều nơi mà VẪN MẶC CÙNG BỘ → chỉ 1 bộ duy nhất.
  CHỈ thêm bộ thứ 2, 3 khi kịch bản CHO THẤY RÕ nhân vật thay đồ (ngủ dậy→đi làm; nhảy thời gian; dịp đặc biệt). Tối đa 3 bộ.
  Mỗi bộ: · "when": giai đoạn/thời điểm mặc (vd "throughout", "morning at home", "years later"). · "desc": mô tả CỤ THỂ, CỐ ĐỊNH, tiếng Anh, đúng thời đại, MỖI MÓN nêu ĐÚNG 1 MÀU cụ thể + KIỂU (vd "a faded navy-blue polo shirt, khaki shorts, white sneakers"). ⚠️ TUYỆT ĐỐI KHÔNG dùng "or"/"hoặc"/nhiều lựa chọn màu — CHỐT 1 màu duy nhất cho từng món để mọi cảnh vẽ giống hệt.
KHÔNG bịa nhân vật, KHÔNG bịa lần thay đồ không có trong kịch bản.
Trả về CHỈ JSON, không markdown:
{"era":"...","characters":[{"slug":"protagonist-male","outfits":[{"when":"throughout","desc":"..."}]}]}

KỊCH BẢN:
"""${String(script || '').slice(0, 14000)}"""`;
  try {
    const data = await callLLMJson(prompt, { maxTokens: 3500, validate: d => d && (Array.isArray(d.characters) || typeof d.era === 'string') });
    const era = (presetEra || String(data.era || '').trim());
    const wb = {};
    if (!noChar) (data.characters || []).forEach(c => {
      const s = String(c.slug || '').trim(); if (!s || !Array.isArray(c.outfits)) return;
      const outs = c.outfits.map(o => ({ when: String(o.when || '').trim(), desc: String(o.desc || '').trim() })).filter(o => o.desc).slice(0, 4);
      if (outs.length) wb[s] = outs;
    });
    return { era, wb };
  } catch (e) { console.warn('wardrobe/era:', e); return { era: presetEra || '', wb: {} }; }
}

async function t2StoryboardAI(){
  if (typeof gateTool === 'function' && gateTool('tool2')) return;
  syncTool2();
  const txt = (state.script || '').trim();
  if (!txt) return setStatus2('⚠️ Chưa có kịch bản. Dán kịch bản vào ô Bước 1 rồi thử lại.', 'error');
  // BẮT BUỘC có MP3 giọng đọc để căn timing chính xác (không cho chạy nếu thiếu)
  const af = (typeof t8State === 'object' && t8State && t8State.audioFile) || (typeof _autoAudioFile !== 'undefined' && _autoAudioFile) || null;
  if (!af) return setStatus2('⚠️ Cần đính MP3 giọng đọc để căn timing. Bấm 🎵 "Đính MP3 căn timing" ở Bước 1 rồi thử lại.', 'error');
  const p = (typeof getProfile === 'function') ? getProfile() : null;
  const secMin = Math.max(2, parseInt(document.getElementById('minSecPerImg')?.value) || 3);
  const secMax = Math.max(secMin + 1, parseInt(document.getElementById('maxSecPerImg')?.value) || 15);
  const secAvg = Math.round((secMin + secMax) / 2);
  // Style anchor GỌN cho cảnh (BỎ characterStyle 300 từ — cái đó thuộc ref nhân vật, nhồi vào đây gây trôi style).
  const style = [p?.visualStyle, p?.sceneStyle, p?.promptRules].map(x => (x || '').trim()).filter(Boolean).join('. ') || 'cinematic, consistent visual style, cohesive lighting';
  // Cụm aesthetic NGẮN, CỐ ĐỊNH — MỌI cảnh KẾT bằng ĐÚNG chuỗi này để đồng nhất 1 style.
  // ⚠️ sceneStyle có thể RẤT DÀI (cả đoạn) → phải RÚT còn ~1 mệnh đề ngắn, nếu không AI sẽ dán cả đoạn vào mỗi prompt (phình) và lô sau tự rút gọn (lệch nhau).
  // ⚠️ BỎ cụm PHỦ ĐỊNH ("not 3D", "no anime", "không 3d"…) trước khi dò style — nếu không regex match nhầm chữ trong câu phủ định
  //    (vd profile flat-2D ghi "NOT 3D" → tưởng là 3D → gắn nhầm "a stylized 3D render").
  // Rút gọn: lấy mệnh đề ĐẦU (tới dấu chấm/xuống dòng/gạch ngang), cắt tối đa ~90 ký tự ở ranh giới từ.
  let _tag = (p?.sceneStyle || p?.visualStyle || p?.characterStyle || '').trim().split(/[\n.]|—|\s-\s/)[0].trim();
  if (_tag.length > 90) _tag = _tag.slice(0, 90).replace(/[\s,;:-]+\S*$/, '').trim();
  if (!_tag) _tag = 'consistent cinematic visual style, cohesive lighting';   // trung tính — KHÔNG tự chèn medium
  // Medium BÁM ĐÚNG style của Profile. Không nhận ra kiểu gì → KHÔNG gắn medium (để chữ của Profile dẫn dắt),
  // trước đây mặc định "2D" nên kênh người thật/lịch sử vẫn ra prompt hoạt hình.
  const _pm = _profileMedium(p);
  const styleTag = _tag + (_pm.medium ? ' — ' + _pm.medium : '');
  // Style NHÂN VẬT riêng của profile (nét vẽ/mặt/tỉ lệ) → ép nhân vật phụ/quần chúng vẽ ĐÚNG style này, khớp nhân vật chính.
  const _charId = (p?.charIdentity || '').trim();
  const _charIdRule = _charId ? ` — cụ thể vẽ theo ĐÚNG style nhân vật của kênh: "${_charId}"` : '';
  const noChar = document.getElementById('noCharMode')?.checked;

  // Đọc độ dài audio để căn timing (af đã bắt buộc có ở trên).
  let audioTotal = 0;
  setStatus2('🎧 Đọc độ dài audio…', 'working'); audioTotal = await _t2AudioDur(af); _t2AudioDurCache = audioTotal;

  clearCancel();
  // Chia kịch bản thành lô để vừa ngữ cảnh, giữ dàn nhân vật/bối cảnh xuyên suốt.
  // ⚠️ CLI bridge VÀ gateway bên thứ 3 (Base URL) hay TREO/hỏng khi output lớn → chia lô NHỎ (mỗi call nhẹ, trả nhanh, không quá timeout gateway).
  // Chỉ API CHÍNH CHỦ (không Base URL) mới để lô lớn cho nhanh.
  const _cliMode = (typeof _usingCli === 'function') ? _usingCli() : false;
  const _thirdParty = !!(localStorage.getItem('api_base_url') || '').trim();   // dùng gateway ngoài (gwai/hhtech…) → coi như CLI: lô nhỏ
  const _smallBatch = _cliMode || _thirdParty;
  // ⚠️ Lô phải đủ NHỎ để output JSON không bị cắt: mỗi cảnh ~150 token, lô 900 từ ≈ 55 cảnh ≈ 8k token.
  // Lô NHỎ = output ngắn = gần như không bao giờ bị cắt, và lỗi 1 lô chỉ mất vài cảnh.
  const _batchWords = _cliMode ? 500 : 600;
  const _batchMaxTok = _smallBatch ? 6000 : 16000;   // trần rộng tay: chỉ trả tiền phần THỰC SỰ sinh ra
  const paras = txt.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const batches = []; let cur = '';
  for (const pa of paras) { if (_wcSb(cur + ' ' + pa) > _batchWords && cur) { batches.push(cur); cur = pa; } else cur = cur ? cur + '\n\n' + pa : pa; }
  if (cur) batches.push(cur);

  // Lập TỦ ĐỒ cố định + SUY THỜI ĐẠI (trang phục/đạo cụ đúng thời, chống drift quần áo).
  if (typeof novaLog === 'function') novaLog(`📝 Phân Cảnh: bắt đầu — kịch bản ${txt.length} ký tự, chia ${batches.length} lô. Nếu dùng CLI (gói Claude/ChatGPT) mỗi bước AI sẽ chậm hơn API.`, 'acc');
  setStatus2('👕 Đang lập tủ đồ + xác định thời đại…', 'working');
  if (typeof novaLog === 'function') novaLog('👕 Đang lập tủ đồ + xác định thời đại (1 lần gọi AI lớn, gửi cả kịch bản)…');
  const _t2t0 = (() => { try { return performance.now(); } catch (e) { return 0; } })();
  const _wp = await _t2PlanWardrobe(txt, noChar, (state.t3Era || '').trim());
  const wardrobe = _wp.wb || {};
  const era = _wp.era || '';
  if (typeof novaLog === 'function') { let _s = ''; try { _s = _t2t0 ? ` (${((performance.now() - _t2t0) / 1000).toFixed(0)}s)` : ''; } catch (e) {} novaLog(`👕 Tủ đồ xong${_s}: ${Object.keys(wardrobe).length} nhân vật cố định${era ? ', thời đại: ' + era : ''}.`, 'ok'); }
  if (era && !state.t3Era) { state.t3Era = era; const _eEl = document.getElementById('t3Era'); if (_eEl) _eEl.value = era; }
  state.wardrobe = wardrobe;
  const eraText = era
    ? `\n- THỜI ĐẠI/BỐI CẢNH: "${era}". MỌI trang phục, kiểu tóc, đạo cụ, kiến trúc, phương tiện PHẢI ĐÚNG thời đại này — TUYỆT ĐỐI không có đồ/vật hiện đại nếu là thời cổ.`
    : '';
  const wbText = Object.keys(wardrobe).length
    ? '\n- TỦ ĐỒ CỐ ĐỊNH (BẮT BUỘC dán ĐÚNG "desc" theo thời điểm — KHÔNG tự chế đồ khác, để cùng giai đoạn mặc GIỐNG NHAU):\n'
      + Object.entries(wardrobe).map(([n, os]) => `  • [${n}]: ${os.map(o => `khi ${o.when} → "${o.desc}"`).join(' · ')}`).join('\n')
    : '';

  // 🎯 LOGLINE toàn video — sinh 1 lần rồi nhồi vào MỌI lô storyboard để các lô sau không lạc mạch/đổi tông (giống web tool).
  let _loglineSb = '';
  setStatus2('🎯 Đang tóm cốt truyện toàn video (logline)…', 'working');
  try { if (typeof genVideoLogline === 'function') _loglineSb = (await genVideoLogline(false)) || ''; } catch (e) { console.warn('logline:', e); }
  if (typeof novaLog === 'function' && _loglineSb) novaLog('🎯 Logline: ' + _loglineSb.slice(0, 120) + (_loglineSb.length > 120 ? '…' : ''), 'acc');
  const loglineText = (_loglineSb && _loglineSb.trim())
    ? `\n\n🎯 BỐI CẢNH TOÀN VIDEO (mọi cảnh PHẢI bám vào đây): "${_loglineSb.trim()}"\n- Mọi cảnh — kể cả cảnh trừu tượng / câu hỏi tu từ / câu chuyển ý — phải nằm trong THẾ GIỚI HÌNH ẢNH của video này (đúng nhân vật, bối cảnh, thời đại, tông màu). KHÔNG vẽ hình generic lạc khỏi câu chuyện.`
    : '';

/* ── Chia cảnh phải BIẾT đang bật nguồn nào ─────────────────────────────
     Bản cũ chia cảnh xong mới chọn nguồn, nên kịch bản luôn được chia theo lối
     "mỗi cảnh một ẢNH AI": cảnh ngắn, nhân vật cố định, tả bối cảnh chi tiết.
     Khi phần lớn cảnh sẽ dùng TƯ LIỆU CÓ SẴN thì lối chia đó sai — tư liệu
     thật cần cảnh DÀI hơn để chuyển động chạy hết, và không thể khớp một nhân
     vật do AI bịa ra. Nên đưa luật riêng vào ngay từ bước chia.             */
  const _nguonThuc = (() => {
    const b = (typeof _t2NguonBat === 'function') ? _t2NguonBat() : {};
    return ['stock', 'yt', 'kho', 'web'].filter(k => b[k]);
  })();
  const _coThuc = _nguonThuc.length > 0;
  const luatNguon = _coThuc ? `

🎥 VIDEO NÀY DÙNG TƯ LIỆU CÓ SẴN (${_nguonThuc.length} nguồn đang bật) — CHIA CẢNH THEO LỐI KHÁC:
- Phần lớn cảnh sẽ lấp bằng CLIP QUAY THẬT, không phải ảnh AI. Vậy nên:
  • Cảnh dùng tư liệu thật hãy để DÀI HƠN (gần ${secMax}s) — clip cần thời gian cho chuyển động chạy hết. Cắt vụn 3 giây một nhát là phí tư liệu và xem giật.
  • ĐỪNG gán nhân vật (character) cho những cảnh này: clip có sẵn không thể khớp mặt một nhân vật do AI bịa. Để character RỖNG.
  • Tả cảnh bằng thứ CÓ THẬT TRÊN ĐỜI và TÌM ĐƯỢC (con vật, đồ vật, nơi chốn, hành động cụ thể) — đừng tả tông màu điện ảnh hay ánh sáng dàn dựng, vì không ai đặt hàng được clip theo tông.
- Đánh dấu "thuc": true cho cảnh nào MÔ TẢ THỨ CÓ THẬT ĐÃ ĐƯỢC QUAY (loài vật, hiện tượng, địa danh, hoạt động đời thường, tư liệu lịch sử, hiện vật). Đánh "thuc": false cho cảnh trừu tượng, ẩn dụ, nội tâm, hoặc cần một nhân vật cố định — những cảnh đó vẫn dùng ảnh AI.
- ẢNH TĨNH chỉ dành cho cảnh GIẢI THÍCH (so sánh, số liệu, bản đồ, hiện vật cần nhìn kỹ). Cảnh kể chuyện thì để tư liệu động.` : '';

  const typesOn = _sceneTypesOn();
  const typeList = typesOn.map(t => `"${t}" (${SCENE_TYPES[t].vi})`).join(' · ');
  const typeRecipes = typesOn.map(t => `  • ${t}: ${SCENE_TYPES[t].recipe}`).join('\n');
  // Kiểu cảnh TẮT thì prompt KHÔNG được nhắc tới, không thì AI vẫn trả về (vd tắt "So sánh" mà storyboard đầy biểu đồ).
  const _hasCmp = typesOn.includes('compare'), _hasMap = typesOn.includes('map');
  const _infoShots = [_hasCmp ? '"compare"' : '', _hasMap ? '"map"' : ''].filter(Boolean).join('/');
  const cmpHint = _hasCmp ? '; đoạn giải thích/so sánh/số liệu → "compare"' : '';
  const cmpRule = _hasCmp
    ? '\n- ⚖️ HẠN CHẾ "compare" (biểu đồ) — ƯU TIÊN KỂ BẰNG HÌNH ẢNH ĐỜI THƯỜNG: KHÔNG biến mọi câu có con số thành biểu đồ. CHỈ dùng "compare" khi PHẢI đặt 2 con số/phương án CẠNH NHAU mới hiểu được (so sánh thật). Còn lại — kể cả câu có tiền/tỉ lệ — hãy diễn bằng CẢNH CỤ THỂ hoặc ẨN DỤ (người cầm xấp tiền, hoá đơn dài, đồ vật chồng cao, bảng giá trên tường, ví rỗng…) dùng "scene"/"close-up"/"b-roll". MỤC TIÊU: "compare" chỉ chiếm ~1/5–1/4 tổng số cảnh. TUYỆT ĐỐI KHÔNG để 2 cảnh "compare" liền nhau — nếu 2 câu liên tiếp đều là số liệu, đổi ít nhất 1 câu sang cảnh đời thường/ẩn dụ.'
    : '\n- ⛔ VIDEO NÀY KHÔNG DÙNG BIỂU ĐỒ/INFOGRAPHIC: TUYỆT ĐỐI KHÔNG trả shot "compare"/"diagram"/"map", KHÔNG vẽ biểu đồ, bảng số, sơ đồ, chart. Câu có số liệu/so sánh vẫn phải kể bằng CẢNH ĐỜI THƯỜNG hoặc ẨN DỤ CỤ THỂ (người cầm xấp tiền, hoá đơn dài, đồ vật chồng cao, bảng giá trên tường, ví rỗng…) với "scene"/"close-up"/"b-roll".';
  const infoBgRule = _infoShots
    ? `📊 RIÊNG biểu đồ/số liệu/infographic (shot ${_infoShots}): ĐỂ background RỖNG (KHÔNG tạo bối cảnh asset) và TẢ THẲNG nội dung biểu đồ NGAY trong "prompt" — mỗi biểu đồ tả RIÊNG theo đúng số liệu/nội dung của nó, KHÔNG gộp chung, KHÔNG bịa số. `
    : '';
  const infoTextRule = _infoShots
    ? `  Cảnh ${_infoShots}: chỉ ÍT chữ THIẾT YẾU (1 tiêu đề 2-4 từ + vài CON SỐ hoặc nhãn 1-2 từ chính), phần lớn là ICON/hình khối/thanh, CHỪA nhiều khoảng trống — TUYỆT ĐỐI KHÔNG nhồi tường chữ, không câu dài, không nhãn mô tả dài.\n`
    : '';
  const noTextRule = _infoShots
    ? `- 🚫 CHỮ TRONG ẢNH: MỌI cảnh KHÔNG phải ${_infoShots} thì TUYỆT ĐỐI KHÔNG có chữ/nhãn/câu/số/watermark/logo nào trong ảnh (phụ đề do khâu dựng lo). Ảnh sạch, chỉ hình.`
    : `- 🚫 CHỮ TRONG ẢNH: TUYỆT ĐỐI KHÔNG cảnh nào có chữ/nhãn/câu/số/watermark/logo trong ảnh (phụ đề do khâu dựng lo). Ảnh sạch, chỉ hình.`;
  // 🔖 Prompt NGẮN (chỉ tag, kiểu @leo/@mia) — MẶC ĐỊNH LUÔN (ẩn UI): nhân vật có slug chỉ ghi [slug] + hành động, KHÔNG lặp trang phục → dựa ảnh tham chiếu.
  const _shortRef = true;
  const promptLen = _shortRef ? '55-110' : '60-120';
  const charSlugRule = _shortRef
    ? `  👤 NHÂN VẬT CÓ slug: CHỈ ghi [slug] + (nếu cần) 1-2 từ tuổi/giới + HÀNH ĐỘNG/tư thế/biểu cảm. ⛔ TUYỆT ĐỐI KHÔNG lặp lại trang phục/tóc/màu đồ trong prompt — ảnh tham chiếu [slug] lo toàn bộ ngoại hình. (Chỉ nhân vật KHÔNG có slug mới tả đầy đủ ngoại hình.) ✅ Chữ TIẾT KIỆM được từ việc bỏ tả trang phục → DỒN VÀO tả MÔI TRƯỜNG/bối cảnh CHI TIẾT + ánh sáng (hướng/màu/tương phản) + bố cục & CHIỀU SÂU (tiền/trung/hậu cảnh) → prompt VẪN GIÀU CHI TIẾT, ĐIỆN ẢNH (chỉ gọn ở phần nhân vật).`
    : `  👤 NHÂN VẬT CÓ slug: ghi [slug] RỒI KÈM NGAY mô tả ngắn-nhưng-ĐỦ trong prompt: tuổi/giới/vóc dáng + tóc + TOÀN BỘ trang phục KÈM ĐÚNG MÀU TỪNG MÓN (dán NGUYÊN VĂN "desc" từ TỦ ĐỒ CỐ ĐỊNH ở trên — vd "a faded navy-blue polo shirt and khaki shorts, white sneakers"). ⚠️ GIỮ Y NGUYÊN màu + kiểu quần áo ở MỌI cảnh — KHÔNG đổi, KHÔNG tự chế, KHÔNG rút gọn màu. (CHỈ đưa ref tag đôi khi VẪN SAI MÀU ĐỒ → BẮT BUỘC nêu rõ màu ngay trong prompt.) Nhân vật nhiều bộ → chọn bộ hợp THỜI ĐIỂM (dựa "when"). MẶT/tuổi/giới/vóc dáng cố định tuyệt đối.`;
  const beats = []; const cast = new Set(Object.keys(wardrobe)), locs = new Set();
  for (let bi = 0; bi < batches.length; bi++) {
    if (state.cancelRequested) { setStatus2('⏸ Đã dừng. Giữ ' + beats.length + ' cảnh.', 'info'); if (typeof novaLog === 'function') novaLog('⏸ Phân Cảnh: đã dừng theo yêu cầu — giữ ' + beats.length + ' cảnh.', 'warn'); break; }
    _llmStep = 'chia cảnh';
    if (typeof novaLog === 'function') novaLog(`🎬 Chia cảnh lô ${bi + 1}/${batches.length}…`);
    const _biN = beats.length;
    const known = 'Nhân vật đã lập: ' + ([...cast].join(', ') || '(chưa có)') + '. Bối cảnh đã lập: ' + ([...locs].join(', ') || '(chưa có)') + '.';
    const _mkPrompt = (SCRIPT) =>
`Bạn là đạo diễn storyboard cho video faceless. Chia ĐOẠN kịch bản dưới thành các CẢNH để tạo ẢNH minh hoạ — GOM theo ý hình ảnh, KHÔNG cắt vụn từng câu.${loglineText}

QUY TẮC:
- Mỗi cảnh = MỘT khung hình, độ dài ${secMin}-${secMax}s đọc (TB ~${secAvg}s ≈ ${Math.round(secAvg * 2.6)} từ). ⛔ BẮT BUỘC: KHÔNG cảnh nào dài quá ${secMax}s. Đoạn văn DÀI phải TÁCH thành NHIỀU cảnh liên tiếp — mỗi cảnh 1 khung hình KHÁC NHAU (đổi góc máy / cận-xa / chi tiết / hành động khác), KHÔNG gộp thành 1 cảnh dài lặp hình. Câu chốt/kịch tính → cảnh NGẮN nhưng ⛔ KHÔNG DƯỚI ${secMin}s: câu quá ngắn (đọc <${secMin}s) thì GỘP với câu liền kề CÙNG Ý thành 1 cảnh, KHÔNG để đứng riêng thành cảnh tí hon. KHÔNG cắt giữa câu.
- GIỮ NGUYÊN VĂN lời đọc ở "text" (nối các câu của cảnh, không sửa chữ).
- Dàn NHÂN VẬT & BỐI CẢNH NHẤT QUÁN cả video, slug NGẮN CỐ ĐỊNH 1-3 từ (vd "protagonist-male","call-center-night"). MỖI người/nơi CHỈ 1 tên duy nhất xuyên suốt — DÙNG LẠI slug đã lập, TUYỆT ĐỐI KHÔNG đổi hậu tố giữa các cảnh (đã dùng "protagonist-male" thì luôn "protagonist-male", KHÔNG lúc "protagonist-male-trader"). ⚠️ GỘP để ÍT bối cảnh: NƠI CHỐN/phòng TƯƠNG TỰ → dùng CHUNG 1 slug; CHỈ tạo slug MỚI khi khác HẲN; ưu tiên tái dùng slug đã có. ${infoBgRule}👤 TẠO slug NHÂN VẬT cho MỌI nhân vật CÓ VAI hoặc được kịch bản nói tới CỤ THỂ — KỂ CẢ người CHỈ xuất hiện 1 LẦN (vd "người mua tivi khổng lồ", "ông ăn thử đồ", "gã cầm ống đồng") → cấp slug để có ẢNH THAM CHIẾU giữ MẶT + trang phục NHẤT QUÁN giữa ảnh A và B. ⚠️ Tối đa ~6 nhân vật cho CẢ video — nếu vượt thì GỘP vai giống nhau / bỏ vai kém quan trọng nhất, KHÔNG đẻ vô tội vạ. CHỈ để character RỖNG (tả đầy đủ inline, KHÔNG tạo asset) cho: đám đông/quần chúng thoáng qua không cần nhận diện, hoặc người lướt qua hoàn toàn không đáng kể. 🏠 BỐI CẢNH — HÃY CHỦ ĐỘNG nhận ra các NƠI CHỐN XƯƠNG SỐNG lặp lại ở ≥2 cảnh và TẠO SLUG cho chúng (video dài thường có 2–6 địa điểm xương sống: vd nhà ở, văn phòng, trụ sở, cửa hàng…). GỘP nơi tương tự vào CHUNG 1 slug; dùng lại slug đã lập, KHÔNG đổi hậu tố. CHỈ để background RỖNG và tả thẳng trong prompt khi: ${_infoShots ? '(a) cảnh biểu đồ/số liệu/infographic, (b)' : '(a)'} nơi chỉ xuất hiện 1 LẦN, hoặc ${_infoShots ? '(c)' : '(b)'} nơi chung chung tả 1 câu là xong (bầu trời, con đường, góc bàn, bãi biển…). ⚠️ ĐỪNG trả về 0 bối cảnh cho video dài — hãy nhặt ÍT NHẤT vài nơi xương sống để giữ không gian nhất quán; CHỈ được trả 0 khi video THỰC SỰ thuần trừu tượng (không có bất kỳ nơi vật lý nào lặp lại). Cân bằng: đủ nơi xương sống cho nhất quán, nhưng đừng biến mỗi nơi thoáng qua thành 1 asset. ${known}${noChar ? ' KÊNH KHÔNG NGƯỜI: mọi cảnh chỉ cảnh vật/đồ vật/quá trình, character để rỗng.' : ''}${eraText}${wbText}
- 🎬 GIÃN NHÂN VẬT: TỐI ĐA 3 cảnh LIÊN TIẾP có cùng một nhân vật. Cứ 3-4 cảnh có người thì PHẢI có ít nhất 1 cảnh KHÔNG người (character rỗng, shot "b-roll"): đồ vật, nơi chốn, cận cảnh chi tiết, quá trình. Video 150+ cảnh mà cảnh nào cũng cùng một người là xem rất chán.
- "shot" = KIỂU CẢNH, chọn ĐÚNG 1 trong: ${typeList}. Mặc định "scene". Chọn theo nội dung: câu MỞ ĐẦU video/hook → "hook"; mở đầu 1 chương/giới thiệu nơi chốn → "establishing"; câu nhấn cảm xúc/chi tiết → "close-up"; câu dẫn chuyện tả cảnh vật không người → "b-roll"${cmpHint}.${cmpRule}
- KHÔNG viết prompt ảnh ở bước này — lượt sau lo. Chỉ trả cấu trúc cảnh.${luatNguon}
- "camera": wide|medium|close. "motion": zoom-in|zoom-out|pan-left|pan-right|static|punch (cảnh ngắn dùng punch/zoom nhanh).

Trả về CHỈ 1 JSON array THEO THỨ TỰ, không markdown:
[{"text":"...","character":"slug hoặc rỗng","background":"slug","camera":"medium","shot":"scene","motion":"zoom-in"${_coThuc ? ', "thuc":true' : ''}}]

ĐOẠN KỊCH BẢN:
"""${SCRIPT}"""`;
    // Gateway/API bên thứ 3 hay RỚT call to ("Failed to fetch") dù call nhỏ vẫn qua → khi rớt MẠNG thì CHIA ĐÔI đoạn gọi lại (call nhẹ dễ qua), tối đa 3 tầng.
    const _isNetErr = (m) => /Failed to fetch|Load failed|NetworkError|ERR_NETWORK|ERR_CONNECTION|socket hang up|ECONN|Quá thời gian|aborted/i.test(String(m || ''));
    const _runSeg = async (SCRIPT, depth) => {
      try { return (await callLLMJson(_mkPrompt(SCRIPT), { maxTokens: _batchMaxTok, validate: a => Array.isArray(a) })) || []; }
      catch (e) {
        const ps = String(SCRIPT).split(/\n+/).map(s => s.trim()).filter(Boolean);
        // CHIA ĐÔI GỌI LẠI cho MỌI lỗi (rớt mạng, JSON hỏng, output bị cắt) — thà mất nửa lô còn hơn mất cả lô.
        if (depth < 4 && ps.length > 1) {
          const mid = Math.ceil(ps.length / 2);
          if (typeof novaLog === 'function') novaLog(`  ↻ Lô ${bi + 1} lỗi: ${String(e.message || '').slice(0, 200)} — chia đôi gọi lại…`, 'warn');
          await new Promise(r => setTimeout(r, 1500));
          const a1 = await _runSeg(ps.slice(0, mid).join('\n\n'), depth + 1);
          await new Promise(r => setTimeout(r, 800));
          const a2 = await _runSeg(ps.slice(mid).join('\n\n'), depth + 1);
          return a1.concat(a2);
        }
        throw e;
      }
    };
    try {
      const arr = await _runSeg(batches[bi], 0);
      (arr || []).forEach(o => {
        const text = String(o.text || '').trim(); if (!text) return;
        const ch = noChar ? '' : String(o.character || '').trim();
        const bg = String(o.background || '').trim();
        if (ch) cast.add(ch); if (bg) locs.add(bg);
        const shot = _validShot(o.shot);
        beats.push({ text, prompt: String(o.prompt || '').trim(), character: ch, background: bg,
          camera: (String(o.camera || 'medium').trim() || 'medium'), shot: shot, motion: String(o.motion || '').trim() || (SCENE_TYPES[shot] ? SCENE_TYPES[shot].motion : ''),
          // Cảnh tả thứ CÓ THẬT đã được quay → ưu tiên giao cho nguồn tư liệu.
          thuc: o.thuc === true });
      });
    } catch (e) { console.warn('storyboard lô ' + bi + ':', e.message); if (typeof novaLog === 'function') novaLog(`⚠️ Lô ${bi + 1} lỗi: ${(e.message || e)}. Bỏ qua, chạy tiếp.`, 'err'); }
    // Lưu NGAY sau mỗi lô — dừng/sập giữa chừng vẫn giữ phần đã có (học web đối thủ: trả về tới đâu lưu tới đó).
    try { if (beats.length) { state.scenes = beats.map((b, i) => ({ id: String(i + 1).padStart(3, '0'), text: b.text, level: 'L1', character: b.character, background: b.background, camera: b.camera, shot: b.shot, motion: b.motion, thuc: !!b.thuc, duration: (typeof calcDur === 'function' ? calcDur(b.text) : 3) })); saveState(true); } } catch (e) {}
    const _pct = Math.round((bi + 1) / batches.length * 100);
    setStatus2(`✨ Chia cảnh… ${beats.length} cảnh · lô ${bi + 1}/${batches.length} · ${_pct}%`, 'working');
    if (typeof novaLog === 'function') novaLog(`  ✓ Lô ${bi + 1}/${batches.length}: +${beats.length - _biN} cảnh (tổng ${beats.length}).`, 'ok');
  }
  if (!beats.length) { if (typeof novaLog === 'function') novaLog('❌ Phân Cảnh: AI chưa tạo được cảnh nào (kiểm tra kết nối AI / CLI).', 'err'); return setStatus2('AI chưa tạo được cảnh. Thử lại hoặc kiểm tra kết nối AI.', 'error'); }

  // GỘP TÊN TRÙNG BIẾN THỂ về 1 tên chuẩn xuyên suốt (khắc phục lô AI đặt tên lệch: protagonist-male ↔ protagonist-male-trader)
  const charMap = _canonMap(beats.map(b => b.character));
  const bgMap = _canonMap(beats.map(b => b.background));
  let _fixed = 0;
  beats.forEach(b => {
    if (b.character && charMap[b.character]) b.character = charMap[b.character];
    if (b.background && bgMap[b.background]) b.background = bgMap[b.background];
    b.prompt = _canonTags(b.prompt, charMap, bgMap);
    // Còn tag nào không nằm trong dàn asset → quy về slug của chính cảnh; không có
    // thì bỏ ngoặc. Để nguyên là tool tạo ảnh thấy một token vô nghĩa và bỏ qua.
    const n = _t2RepairTags(b);
    if (n) _fixed += n;
  });
  if (_fixed && typeof novaLog === 'function') novaLog(`🔧 Sửa ${_fixed} tag lạ trong prompt (tag không có ảnh tham chiếu → nhân vật biến mất khỏi cảnh).`, 'ok');

  const totalWords = beats.reduce((a, b) => a + _wcSb(b.text), 0) || 1;
  const totalDur = audioTotal > 0 ? audioTotal : beats.reduce((a, b) => a + calcDur(b.text), 0);
  const maxScenes = (typeof getMaxScenes === 'function') ? getMaxScenes() : Infinity;
  let cut = 0; if (beats.length > maxScenes) { cut = beats.length - maxScenes; beats.length = maxScenes; }

  state.scenes = beats.map((b, i) => ({
    id: String(i + 1).padStart(3, '0'), text: b.text, level: 'L1',
    character: b.character, background: b.background, camera: b.camera, shot: b.shot, motion: b.motion, thuc: !!b.thuc,
    duration: Math.max(1, +((totalDur * _wcSb(b.text) / totalWords)).toFixed(1)),
  }));
  state.scenePrompts = {}; state.scenePrompts2 = {};
  // 🔒 ÉP [tag] nhân vật/bối cảnh vào prompt (chế độ Tag) → tool tạo ảnh đính ĐÚNG ref, không lạc nhân vật. AI hay quên ngoặc.
  beats.forEach((b, i) => { if (b.prompt) state.scenePrompts[String(i + 1).padStart(3, '0')] = _ensureSceneTags(b.prompt, { character: b.character, background: b.background }); });

  // ⛔ CẮT TRẦN cứng: cảnh nào dài hơn max giây → TÁCH thành nhiều cảnh (chia đều thời lượng + text theo câu), giữ prompt/nhân vật/bối cảnh.
  // Dùng lại được (gọi cả TRƯỚC và SAU khi Whisper căn giọng — vì Whisper có thể căn 1 cảnh dài vượt max SAU khi đã cắt lần đầu).
  // Góc máy tiến dần cho các ảnh CÙNG 1 cảnh gốc → tránh ảnh giống hệt (chán).
  const _SPLIT_FRAMES = [
    { cam: 'wide',   mo: 'zoom-in',   note: 'wide establishing framing of this scene' },
    { cam: 'medium', mo: 'pan-right', note: 'tighter medium shot of the same moment from a different camera angle' },
    { cam: 'close',  mo: 'zoom-in',   note: 'close-up detail from the same scene, a new angle' },
    { cam: 'medium', mo: 'pan-left',  note: 'reverse-angle medium shot of the same scene' },
  ];
  // allowSubSplit: cho phép chia 1 CÂU ĐƠN dài (không tách được theo câu) thành NHIỀU ẢNH (cùng text, khác góc máy)
  //   → chỉ bật ở lần cắt SAU Whisper (thời lượng đã thật; không còn căn giọng nên text trùng không gây loạn).
  const _enforceMaxDur = (cap, allowSubSplit) => {
    if (!(cap > 0)) return 0;
    const _splitTxt = (t, n) => { const s = (String(t).match(/[^.!?…。！？]+[.!?…。！？]*/g) || [t]).map(x => x.trim()).filter(Boolean); if (s.length <= 1) return [t]; const per = Math.ceil(s.length / n); const r = []; for (let k = 0; k < n; k++){ const c = s.slice(k * per, (k + 1) * per).join(' ').trim(); if (c) r.push(c); } return r.length ? r : [t]; };
    const outScenes = [], outPrompts = {}; let nSplit = 0;
    // CẢNH DÀI KHÔNG tách thành cảnh riêng cùng-câu nữa (tránh 2 ảnh trùng lời). Giữ tới 2× max trong MỘT cảnh
    // → autoAddPromptBForLongScenes() sẽ thêm ẢNH B (prompt AI khác) → 2 ảnh/1 cảnh, Dựng Video chia đôi thời lượng.
    // CHỈ tách cảnh khi CỰC dài (>2× max) VÀ nhiều câu — mỗi phần vẫn ≤2× max để B lấp phần còn lại.
    for (const sc of state.scenes){
      const pr = state.scenePrompts[sc.id] || '';
      if (sc.duration <= cap * 2){ const id = String(outScenes.length + 1).padStart(3, '0'); outScenes.push({ ...sc, id }); if (pr) outPrompts[id] = pr; continue; }
      const nBy = Math.min(6, Math.max(2, Math.ceil(sc.duration / (cap * 2))));
      const texts = _splitTxt(sc.text, nBy); const m = texts.length;
      const wc = texts.map(t => Math.max(1, _wcSb(t))); const totW = wc.reduce((a, b) => a + b, 0) || 1;
      texts.forEach((tx, pi) => {
        const partDur = Math.max(1, +(sc.duration * wc[pi] / totW).toFixed(1));
        const id = String(outScenes.length + 1).padStart(3, '0');
        outScenes.push({ ...sc, id, text: tx, duration: partDur });   // mỗi câu 1 cảnh, giữ prompt A; autoAddB thêm B sau
        if (pr) outPrompts[id] = pr;
      });
      if (m > 1) nSplit++;
    }
    if (nSplit) { state.scenes = outScenes; state.scenePrompts = outPrompts; }
    return nSplit;
  };
  _enforceMaxDur(secMax, false);
  _llmStep = 'khác';
  try {
    const _cv = _t2Coverage(state.script, state.scenes);
    if (typeof novaLog === 'function'){
      if (_cv.missing.length) novaLog(`⚠️ Độ phủ: ${_cv.missing.length}/${_cv.total} câu kịch bản KHÔNG có trong cảnh nào — vd: "${_cv.missing[0].slice(0, 60)}…"`, 'warn');
      if (_cv.dup.length) novaLog(`⚠️ ${_cv.dup.length} cảnh TRÙNG lời đọc (${_cv.dup.slice(0, 5).join(', ')}).`, 'warn');
      if (!_cv.missing.length && !_cv.dup.length) novaLog(`✓ Độ phủ: đủ ${_cv.total} câu, không cảnh nào trùng lời.`, 'ok');
    }
  } catch (e) {}
  _t2MarkVideoScenes();   // 🎬 đánh dấu vài cảnh động làm video (xen giữa ảnh tĩnh)
  if (typeof novaLog === 'function'){ const _nv = (state.scenes || []).filter(s => s.wantVideo).length, _ns = (state.scenes || []).filter(s => s.wantStock).length, _ny = (state.scenes || []).filter(s => s.wantYt).length; novaLog(`🎞 Chia cảnh xong: ${state.scenes.length} cảnh${_nv ? ' · ' + _nv + ' cảnh 🎬 Veo' : ''}${_ns ? ' · ' + _ns + ' cảnh 🎞 stock' : ''}${state.ytMix ? ' · ' + _ny + ' cảnh ▶️ YouTube' : ''}.`, 'ok'); }

  // CĂN CHÍNH XÁC TỪNG CẢNH theo giọng đọc: Whisper transcribe MP3 + align lời vào timestamp thật.
  // Nếu Whisper lỗi/không có → giữ timing ước lượng theo chữ (đã tính ở trên).
  // Whisper TỰ LẤY NGÔN NGỮ theo Profile (vi/en/ko/… ; không map được → auto-detect).
  // _t8TranscribeBlob đọc từ DOM #t8Language (panel Tool 8 ẩn nhưng còn) → phải set cả DOM.
  try {
    if (typeof _langVoiceCode === 'function') {
      const _lc = _langVoiceCode(_profileLang()) || '';
      localStorage.setItem('t8_language', _lc);
      const _le = document.getElementById('t8Language'); if (_le) _le.value = _lc;
    }
  } catch (e) {}
  try {
    if (_autoAudioFile !== af) { _autoAudioFile = af; _autoAudioWords = null; }
    if (typeof _autoAlignAudioOnce === 'function') {
      setStatus2('🎯 Đang căn timing chính xác theo giọng đọc (Whisper)…', 'working');
      if (typeof novaLog === 'function') novaLog('🎯 Căn timing theo giọng đọc (Whisper transcribe MP3)…');
      const nAlign = await _autoAlignAudioOnce();
      if (nAlign == null) { setStatus2('⚠️ Whisper chưa transcribe được — tạm dùng timing ước lượng theo chữ (cài key Groq ở Cài đặt để chính xác hơn).', 'info'); if (typeof novaLog === 'function') novaLog('⚠️ Whisper chưa transcribe được — dùng timing ước lượng theo chữ.', 'warn'); }
      else if (typeof novaLog === 'function') novaLog(`🎯 Căn timing xong: ${nAlign} cảnh khớp giọng đọc.`, 'ok');
    }
  } catch (e) { console.warn('whisper align:', e); }

  // 🔗 GỘP CẢNH NGẮN sau Whisper: cảnh dưới min giây → gộp vào cảnh liền TRƯỚC (nối lời, cộng giây), miễn không vượt max.
  const _mergeShort = (minS, maxS) => {
    if (!(minS > 0) || !Array.isArray(state.scenes) || state.scenes.length < 2) return 0;
    const out = [], outP = {}; let merged = 0;
    for (const s of state.scenes){
      const pr = state.scenePrompts[s.id] || '';
      const prev = out[out.length - 1];
      if (prev && s.duration < minS && (prev.duration + s.duration) <= maxS * 1.05 && s.text && !prev.text.includes(String(s.text).trim())){
        prev.text = (prev.text + ' ' + s.text).trim();          // gộp lời vào cảnh trước (bỏ qua mảnh CÙNG LỜI = biến thể góc máy để không nhân đôi text)
        prev.duration = +(prev.duration + s.duration).toFixed(1); // giữ prompt/nhân vật/bối cảnh của cảnh trước
        merged++;
      } else {
        const id = String(out.length + 1).padStart(3, '0');
        out.push({ ...s, id }); if (pr) outP[id] = pr;
      }
    }
    if (merged){ state.scenes = out; state.scenePrompts = outP; }
    return merged;
  };
  const _nMerge = _mergeShort(secMin, secMax);
  if (_nMerge && typeof novaLog === 'function') novaLog(`🔗 Gộp ${_nMerge} cảnh ngắn (<${secMin}s) vào cảnh liền trước.`, 'ok');

  // ⛔ ÉP LẠI CAP SAU WHISPER: Whisper có thể căn 1 cảnh dài vượt max (vd 14.5s > 8s) → cắt lại + đánh dấu lại.
  const _nCut2 = _enforceMaxDur(secMax, true);   // sau Whisper: cho phép chia câu đơn dài thành nhiều ảnh khác góc máy
  if (_nCut2 && typeof novaLog === 'function') novaLog(`⛔ Cắt lại ${_nCut2} cảnh vượt ${secMax}s sau khi căn giọng (câu dài → nhiều ảnh đổi góc).`, 'ok');
  const _nMerge2 = _mergeShort(secMin, secMax);   // GỘP LẠI cảnh ngắn (khác lời) sinh ra sau bước cắt → hết cảnh <min như "The window." 1s
  if (_nMerge2 && typeof novaLog === 'function') novaLog(`🔗 Gộp thêm ${_nMerge2} cảnh ngắn sau khi cắt.`, 'ok');
  if (_nCut2 || _nMerge || _nMerge2) _t2MarkVideoScenes();

  // ── AI chọn nguồn hình cho từng cảnh (chỉ khi có nguồn nào được bật) ──
  // Chạy SAU khi cảnh đã chốt số lượng, vì nó đọc lời thoại từng cảnh.
  try {
    const _b = _t2NguonBat();
    if (Object.values(_b).some(Boolean) && !state.cancelRequested){
      setStatus2('🎯 AI chọn nguồn hình cho từng cảnh…', 'working');
      const _r = await _t2ChonNguonChoCanh(state.scenes || []);
      if (_r && _r.doi) {
        if (typeof novaLog === 'function') novaLog(`🎯 ${_r.doi}/${state.scenes.length} cảnh dùng nguồn ngoài, còn lại ảnh AI (trần ${_r.tran}).`, 'ok');
      } else {
        // AI không đổi cảnh nào (hoặc lỗi cả lô) → chia đều theo cửa sổ như bản cũ.
        _t2MarkVideoScenes();
        if (typeof novaLog === 'function') novaLog('🎯 AI không chọn được nguồn — dùng cách chia đều theo cửa sổ.', 'warn');
      }
    }
  } catch (e){ try { _t2MarkVideoScenes(); } catch (_) {} }

  // Đổ dàn nhân vật/bối cảnh sang hệ asset (để tab "Nhân vật & Bối cảnh" dùng)
  _collectCastToAssets();

  // Nếu người dùng đã bấm Dừng → chốt phần đã có, KHÔNG chạy tiếp bước viết mô tả.
  if (state.cancelRequested) {
    clearCancel();
    if (typeof renderAllT2 === 'function') renderAllT2();
    saveState();
    setStatus2(`⏸ Đã dừng. Giữ ${state.scenes.length} cảnh + prompt (chưa viết mô tả nhân vật — bấm "🔄 Viết lại mô tả" khi cần).`, 'info');
    return;
  }

  // TỰ viết prompt reference sheet cho nhân vật/bối cảnh → xong là bấm "Tạo tất cả ảnh" chạy luôn
  try {
    if (typeof loadAssetsFromTool2 === 'function') loadAssetsFromTool2(true);
    if (typeof genAllAssetPrompts === 'function') { setStatus2('✨ Đang viết mô tả nhân vật & bối cảnh…', 'working'); if (typeof novaLog === 'function') novaLog('✍️ Viết mô tả nhân vật & bối cảnh (prompt reference sheet)…'); await genAllAssetPrompts(); }
  } catch (e) { console.warn('auto asset prompts:', e); if (typeof novaLog === 'function') novaLog('⚠️ Viết mô tả gặp lỗi: ' + (e.message || e), 'err'); }
  // ── LƯỢT 2: viết prompt ảnh cho từng cảnh (tách khỏi lượt chia cảnh → output mỗi call nhỏ, hỏng 1 lô không mất cảnh)
  if (!state.cancelRequested) {
    try {
      setStatus2('✍️ Lượt 2: viết prompt ảnh cho từng cảnh…', 'working');
      if (typeof novaLog === 'function') novaLog('✍️ Lượt 2 — viết prompt ảnh (mỗi lô vài cảnh, lỗi chỉ mất cảnh đó)…');
      await doGenerateScenePrompts();
    } catch (e) { console.warn('lượt 2 prompt:', e); if (typeof novaLog === 'function') novaLog('⚠️ Lượt 2 lỗi: ' + (e.message || e), 'err'); }
  }
  // Cảnh dài vượt max giây/ẢNH (không phải infographic) → thêm ẢNH B (prompt AI khác) → Dựng Video chia đôi ⇒ MỖI ảnh ≤ max. Infographic giữ 1 ảnh (chart hiển thị lâu, tránh 2 chart trùng).
  if (!state.cancelRequested) {
    try { if (typeof autoAddPromptBForLongScenes === 'function') { if (typeof novaLog === 'function') novaLog('✂️ Thêm ảnh B cho cảnh dài (>max giây/ảnh) → mỗi ảnh trong ngưỡng…'); await autoAddPromptBForLongScenes(true); } } catch (e) { console.warn('autoAddB:', e); if (typeof novaLog === 'function') novaLog('⚠️ Thêm ảnh B lỗi: ' + (e.message || e), 'err'); }
  }
  // 🎞 Cảnh đánh dấu Xen video stock → tìm luôn (chỉ gọi API tìm, vài giây/cảnh, chưa tải file).
  const _stk = (state.scenes || []).filter(s => s.wantStock && !(state.mediaPicks || {})[s.id]);
  if (_stk.length && !state.cancelRequested){
    if (typeof getPexelsKey === 'function' && (getPexelsKey() || getPixabayKey())){
      try {
        setStatus2(`🎞 Tìm video stock cho ${_stk.length} cảnh…`, 'working');
        await t2FetchStockVideos();
        const got = _stk.filter(x => (state.mediaPicks || {})[x.id]).length;
        if (typeof novaLog === 'function') novaLog(`🎞 Video stock: ${got}/${_stk.length} cảnh có ứng viên.`, got ? 'ok' : 'warn');
      } catch (e) { if (typeof novaLog === 'function') novaLog('⚠️ Tìm stock lỗi: ' + (e.message || e), 'err'); }
    } else if (typeof novaLog === 'function') {
      novaLog(`🎞 ${_stk.length} cảnh đánh dấu stock — thiếu API key Pexels/Pixabay (Cài đặt → Nguồn ảnh/video stock).`, 'warn');
    }
  }
  // 🎬 VEO: cần ảnh cảnh đã tạo xong mới làm được (ảnh→video) + tốn quota Flow → KHÔNG tự chạy, chỉ nhắc.
  const _veo = (state.scenes || []).filter(s => s.wantVideo).length;
  if (_veo && typeof novaLog === 'function') novaLog(`🎬 ${_veo} cảnh đánh dấu Veo — tạo ảnh xong rồi sang tab Tạo Video để dựng (cần ảnh trước, tốn quota Flow).`, 'acc');
  // ▶️ Cảnh đánh dấu Xen clip YouTube → LẤY CLIP luôn ở đây (trước chỉ đánh dấu rồi bỏ đó).
  const _yt = (state.scenes || []).filter(s => s.wantYt && !(state.mediaPicks || {})[s.id]);
  if (_yt.length && !state.cancelRequested && window.native && typeof window.native.smartClip === 'function'){
    setStatus2(`▶️ Lấy clip YouTube cho ${_yt.length} cảnh (~${Math.round(_yt.length * 0.8)} phút) — bấm Dừng nếu muốn bỏ qua…`, 'working');
    if (typeof novaLog === 'function') novaLog(`▶️ Lấy clip YouTube cho ${_yt.length} cảnh đã đánh dấu…`);
    try {
      const r = await _autoFetchYtClips(_yt, 20 * 60000);
      if (typeof novaLog === 'function') novaLog(`▶️ Clip YouTube: ${r.ok}/${_yt.length} cảnh${r.stop ? ' (dừng: ' + r.stop + ')' : ''}.`, r.ok ? 'ok' : 'warn');
    } catch (e) { if (typeof novaLog === 'function') novaLog('⚠️ Lấy clip lỗi: ' + (e.message || e), 'err'); }
  } else if (_yt.length && typeof novaLog === 'function') {
    novaLog(`▶️ ${_yt.length} cảnh đánh dấu YouTube — mở app Nova để lấy clip (bản web không chạy được yt-dlp).`, 'warn');
  }
  if (typeof renderAllT2 === 'function') renderAllT2();
  saveState();
  if (state.cancelRequested) { clearCancel(); setStatus2(`⏸ Đã dừng. Giữ ${state.scenes.length} cảnh.`, 'info'); return; }
  const dm = Math.floor(totalDur / 60), ds = Math.round(totalDur % 60);
  setStatus2(`✓ Storyboard: ${state.scenes.length} cảnh mạch lạc + prompt${audioTotal > 0 ? ` · khớp audio ${dm}:${String(ds).padStart(2, '0')}` : ''}${cut ? ` (cắt ${cut} vượt gói)` : ''}. Xem tab "Prompt ảnh".`, 'ok');
  if (typeof novaLog === 'function') novaLog(`✅ Phân Cảnh HOÀN TẤT: ${state.scenes.length} cảnh + prompt + mô tả nhân vật/bối cảnh${cut ? ' (cắt ' + cut + ' cảnh vượt gói)' : ''}.`, 'ok');
}

async function doSplit(){
  syncTool2();
  const txt = state.script.trim();
  if (!txt) return setStatus2('Cần kịch bản.', 'error');
  setStatus2('Đang chia cảnh...', 'working');
  try {
    let scenes;
    if (state.splitMode === 'smart') {
      scenes = await splitScenesSmart(txt, state.minChars, state.maxChars);
    } else {
      scenes = splitScenesFast(txt, state.minChars, state.maxChars);
    }
    state.scenes = scenes.map((s, i) => ({
      id: String(i + 1).padStart(3, '0'),
      text: s,
      level: 'L1',
      character: '',
      background: '',
      camera: 'medium',
      duration: calcDur(s)
    }));
    // Cap số cảnh theo tier
    const maxScenes = getMaxScenes();
    let trimmedNotice = '';
    if (state.scenes.length > maxScenes) {
      const cut = state.scenes.length - maxScenes;
      state.scenes = state.scenes.slice(0, maxScenes);
      trimmedNotice = ` (Đã cắt ${cut} cảnh vượt giới hạn gói Free — nâng cấp Pro để mở khoá)`;
      // Show upgrade modal sau 500ms để user kịp đọc status
      setTimeout(() => showGate(`Kịch bản chia ra ${maxScenes + cut} cảnh, nhưng gói Free chỉ giữ ${maxScenes}. Nâng cấp Pro để dùng không giới hạn.`), 500);
    }
    state.scenePrompts = {};
    state.scenePrompts2 = {};
    renderAllT2();
    setStatus2(`✓ Đã chia thành ${state.scenes.length} cảnh.${trimmedNotice}`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function doPrescan(){
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  const p = getProfile();
  if (!p) return setStatus2('Cần tạo Profile trước.', 'error');

  setStatus2('AI đang quét nhân vật & bối cảnh...', 'working');
  const bibleMode = (state.descMode === 'inline_bible');
  try {
    const allText = state.scenes.map(s => s.text).join(' ');
    const prompt = bibleMode
      ? `Đọc toàn bộ kịch bản và liệt kê NHÂN VẬT (người) + BỐI CẢNH (location) sẽ xuất hiện, KÈM mô tả ngoại hình cố định để giữ nhất quán.

Quy tắc:
- Tên: kebab-case tiếng Anh (vd: protagonist-young, hospital-room).
- "desc": MÔ TẢ NGOẠI HÌNH cố định bằng TIẾNG ANH (nhân vật: tuổi, giới, trang phục+màu, tóc, đặc điểm; bối cảnh: loại nơi, đồ vật, ánh sáng, tông màu). 15-30 từ. Đây sẽ được chèn vào MỌI cảnh dùng nhân vật/bối cảnh đó nên phải đủ chi tiết + nhất quán.
- Liệt kê MỌI nhân vật NGƯỜI được VẼ ở ≥2 cảnh → cấp slug riêng (để có ảnh tham chiếu, giữ MẶT nhất quán): nhân vật CHÍNH, người phụ TÁI XUẤT, và cả "người xem"/viewer trong đoạn kêu gọi like-subscribe NẾU kịch bản có cảnh quay người xem. Người CHỈ xuất hiện 1 LẦN thì KHÔNG liệt kê (sẽ tả inline trong prompt). Tối đa 10 nhân vật, 8 bối cảnh.

Kịch bản:
"""
${allText.slice(0, 8000)}
"""

Trả về CHỈ JSON:
{"characters":[{"name":"...","desc":"..."}],"backgrounds":[{"name":"...","desc":"..."}]}`
      : `Đọc toàn bộ kịch bản và liệt kê NHÂN VẬT (người) + BỐI CẢNH (location) sẽ xuất hiện.

Quy tắc đặt tên:
- Nhân vật: kebab-case tiếng Anh, mô tả ngắn vai trò + đặc điểm (vd: protagonist-young, narrator, agent-male, victim-female)
- Bối cảnh: kebab-case tiếng Anh, mô tả nơi chốn (vd: dark-office-night, kitchen-interior, hospital-room)
- Liệt kê MỌI nhân vật NGƯỜI được VẼ ở ≥2 cảnh (cần giữ MẶT nhất quán → cấp slug): nhân vật chính, người phụ TÁI XUẤT, và cả "người xem"/viewer đoạn kêu gọi like-subscribe NẾU có cảnh quay người xem. Người CHỈ xuất hiện 1 LẦN → KHÔNG liệt kê (tả inline). Động vật không liệt kê (tả trực tiếp trong prompt cảnh).
- Tối đa 10 nhân vật, 8 bối cảnh.

Kịch bản:
"""
${allText.slice(0, 8000)}
"""

Trả về CHỈ JSON:
{"characters": ["name1", "name2"], "backgrounds": ["bg1", "bg2"]}`;
    const maxTok = bibleMode ? 1500 : 800;
    // callLLMJson: lặp + ép JSON + chỉ nhận khối có ít nhất 1 mảng characters/backgrounds
    const data = await callLLMJson(prompt, {
      maxTokens: maxTok,
      validate: d => d && typeof d === 'object' && (Array.isArray(d.characters) || Array.isArray(d.backgrounds))
    });
    if (bibleMode) {
      state.charBible = {}; state.bgBible = {};
      state.charactersV = (data.characters || []).map(c => {
        const name = typeof c === 'string' ? c : c.name;
        if (c.desc) state.charBible[name] = c.desc;
        return name;
      });
      state.backgroundsV = (data.backgrounds || []).map(b => {
        const name = typeof b === 'string' ? b : b.name;
        if (b.desc) state.bgBible[name] = b.desc;
        return name;
      });
    } else {
      state.charactersV = (data.characters || []).map(c => typeof c === 'string' ? c : c.name);
      state.backgroundsV = (data.backgrounds || []).map(b => typeof b === 'string' ? b : b.name);
    }
    // Bỏ nhân vật GHÉP + QUẦN CHÚNG khỏi danh sách (mỗi người 1 sheet, không tạo sheet cho quần chúng).
    if (typeof _isComboName === 'function') state.charactersV = (state.charactersV || []).filter(n => n && !_isComboName(n) && !_isCrowdName(n));
    if (typeof _isCrowdName === 'function') state.backgroundsV = (state.backgroundsV || []).filter(n => n && !_isCrowdName(n));
    { const ci = document.getElementById('charsInputV'); if (ci) ci.value = state.charactersV.join('\n'); }
    { const bi = document.getElementById('bgInputV'); if (bi) bi.value = state.backgroundsV.join('\n'); }
    renderStats2();
    setStatus2(`✓ Tìm thấy ${state.charactersV.length} nhân vật + ${state.backgroundsV.length} bối cảnh.` + (bibleMode ? ' Đã tạo hồ sơ mô tả.' : ''), 'ok');
    saveState();
    return state.charactersV.length + state.backgroundsV.length;   // >0 = quét được, để Auto biết
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi quét nhân vật/bối cảnh: ' + e.message, 'error');
    return 0;   // lỗi → trả 0 để Auto retry / không âm thầm bỏ Gán
  }
}

async function doAssign(only){
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  if (state.charactersV.length === 0 && state.backgroundsV.length === 0)
    return setStatus2('Cần Quét Trước nhân vật/bối cảnh trước.', 'error');

  // only = danh sách cảnh CẦN gán lại (vd cảnh trống sau lần Gán đầu).
  // DeepSeek trả KHÁC NHAU mỗi lần → TÍCH LUỸ: chỉ gán cảnh CHƯA có gì, GIỮ NGUYÊN cảnh đã gán
  // (tránh bấm lại bị nhảy kết quả / xoá mất cảnh đã đúng). Provider khác (Claude/OpenAI) ổn định → gán tất như cũ.
  const provider = localStorage.getItem('api_provider') || 'anthropic';
  const isDeepSeek = provider === 'deepseek';
  const needsAssign = s => !s.character && !s.background;
  const isFullCall = !(Array.isArray(only) && only.length);
  const pool = !isFullCall ? only : (isDeepSeek ? state.scenes.filter(needsAssign) : state.scenes);
  if (!pool.length) { setStatus2('✓ Mọi cảnh đã có nhân vật/bối cảnh — không cần gán lại.', 'ok'); return; }
  const bs = parseInt(document.getElementById('batchSize')?.value) || 5;
  setStatus2('AI đang gán nhân vật + bối cảnh...', 'working');
  clearCancel();
  const charList = state.charactersV.map(c => '- ' + c).join('\n') || '(không có)';
  const bgList   = state.backgroundsV.map(b => '- ' + b).join('\n') || '(không có)';
  const CAM = ['wide', 'medium', 'close', 'over-shoulder', 'pov'];
  // Chỉ nhận tên KHỚP danh sách (khớp đúng, hoặc gần đúng kiểu chứa nhau) — chống AI bịa tên
  const matchInList = (name, list) => {
    const n = String(name || '').toLowerCase().trim();
    if (!n) return '';
    const exact = list.find(x => x.toLowerCase() === n);
    if (exact) return exact;
    return list.find(x => { const lx = x.toLowerCase(); return lx.includes(n) || n.includes(lx); }) || '';
  };
  const buildAssignPrompt = (batch) => `Gán nhân vật + bối cảnh + góc camera + cấp cho mỗi cảnh.

DANH SÁCH NHÂN VẬT (chỉ được chọn ĐÚNG 1 tên từ đây, hoặc "" nếu cảnh không có người):
${charList}

DANH SÁCH BỐI CẢNH (chỉ được chọn ĐÚNG 1 tên từ đây, hoặc "" nếu không rõ):
${bgList}

Quy tắc:
- character / background: PHẢI là tên y hệt trong danh sách trên, hoặc "" — KHÔNG bịa tên mới.
- camera: wide | medium | close | over-shoulder | pov
- level: L1 | L2 | L3 | L4

Trả về CHỈ 1 JSON object, key = id cảnh:
{"001":{"character":"...","background":"...","camera":"medium","level":"L1"}, "002":{...}}

CÁC CẢNH:
${batch.map(s => `[${s.id}] "${s.text}"`).join('\n')}`;

  // Chuẩn hoá kết quả về dạng { id: {character,background,camera,level} } dù AI trả object hay array
  const normalize = (parsed) => {
    const o = {};
    if (Array.isArray(parsed)) { for (const x of parsed) if (x && x.id) o[String(x.id).padStart(3, '0')] = x; }
    else if (parsed && typeof parsed === 'object') { for (const [k, v] of Object.entries(parsed)) o[String(k).padStart(3, '0')] = v || {}; }
    return o;
  };

  // 1 lượt gán cho 1 danh sách cảnh (tách ra để gọi lại ở pass 2)
  const runAssign = async (poolScenes) => {
    const lanes = _concurrency();
    const batches = [];
    for (let i = 0; i < poolScenes.length; i += bs) batches.push(poolScenes.slice(i, i + bs));
    let done = 0;
    await runConcurrent(batches, async (batch) => {
      if (state.cancelRequested) return;
      const batchIds = new Set(batch.map(s => s.id));
      // callLLMJson: lặp + ép JSON + chỉ nhận khối normalize ra ≥1 cảnh hợp lệ
      let obj = null;
      try {
        const got = await callLLMJson(buildAssignPrompt(batch), {
          maxTokens: 1500,
          validate: p => Object.keys(normalize(p)).length > 0
        });
        obj = normalize(got);
      } catch (e) { console.warn('Gán batch lỗi:', e.message); }
      if (obj) {
        for (const [id, x] of Object.entries(obj)) {
          if (!batchIds.has(id)) continue;            // chỉ ghi cho cảnh thuộc batch này
          const sc = state.scenes.find(s => s.id === id);
          if (!sc) continue;
          const mc = matchInList(x.character, state.charactersV);   // chỉ nhận tên có thật
          const mb = matchInList(x.background, state.backgroundsV);
          // DeepSeek: KHÔNG ghi đè '' lên giá trị đã có (tránh xoá nhầm cảnh đúng); provider khác gán bình thường
          if (mc || !isDeepSeek) sc.character = mc;
          if (mb || !isDeepSeek) sc.background = mb;
          sc.camera = CAM.includes(x.camera) ? x.camera : (sc.camera || 'medium');
          sc.level = /^L[1-4]$/.test(x.level) ? x.level : (sc.level || 'L1');
        }
      }
      done += batch.length;
      renderAllT2();
      setStatus2(`Gán... ${Math.min(done, poolScenes.length)}/${poolScenes.length}${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
    }, lanes, () => state.cancelRequested);
  };

  try {
    await runAssign(pool);
    if (state.cancelRequested) {
      clearCancel();
      setStatus2('⏸ Đã dừng. Kết quả gán được giữ lại.', 'info');
      saveState();
      return;
    }
    // 🔁 PASS 2 (chỉ DeepSeek, lần gán đầy đủ): cảnh VẪN trống → kiểm lại 1 lần nữa
    // (DeepSeek flaky: cảnh trống có thể do batch lỗi, không phải vì thật sự không có nhân vật/bối cảnh)
    if (isDeepSeek && isFullCall) {
      const still = state.scenes.filter(needsAssign);
      if (still.length && still.length < state.scenes.length) {
        setStatus2(`🔁 Kiểm lần 2: ${still.length} cảnh còn trống...`, 'working');
        clearCancel();
        await runAssign(still);
        if (state.cancelRequested) { clearCancel(); setStatus2('⏸ Đã dừng (sau kiểm lần 2). Kết quả được giữ lại.', 'info'); saveState(); return; }
      }
    }
    // Cảnh báo nếu gán được quá ít (dấu hiệu model trả rác) → khuyên đổi provider
    const withRes = state.scenes.filter(s => s.character || s.background).length;
    if (withRes < state.scenes.length * 0.15) {
      setStatus2(`⚠️ Chỉ gán được ${withRes}/${state.scenes.length} cảnh — model có thể trả JSON lỗi. Thử đổi provider sang Claude/OpenAI cho bước Gán, hoặc Quét Trước lại.`, 'info');
    } else {
      setStatus2(`✓ Đã gán xong (${withRes}/${state.scenes.length} cảnh có nhân vật/bối cảnh).`, 'ok');
    }
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

// === L?: const VISUAL_METAPHOR_RULE ===
const VISUAL_METAPHOR_RULE = `
🎭 VISUAL METAPHOR RULE — many narration lines are abstract (ideas, emotions, the passing of time, cause and effect, statistics, generalizations). NEVER render such a line as a plain talking head or a text panel. Instead invent ONE concrete, depictable scene that carries the idea through tangible objects, actions and staging.
- Map the concept to props: lost opportunity → a door closing or a path forking away; passing time → an hourglass, a burning-down candle, a clock; growth → a rising stack or tower; a hidden deal → a sealed or unfurling document; looming danger → a long shadow or cracking ground; a hard choice → a fork in the road; a burden → a heavy weight on the shoulders. Pick objects that fit the script's era and setting.
- MATCH THE METAPHOR TO THE STYLE'S REALISM. For stylized looks (2D cartoon, illustration, infographic, anime) overt symbolic props and exaggerated staging are welcome. For photorealistic / live-action-cinematic looks, keep metaphors grounded and subtle — real objects in plausible real settings, carrying meaning through composition, lighting, gesture and depth of field rather than floating or glowing symbols, so the shot never looks fake or absurd.
- Respect whatever character design, era and style are defined for this profile; the metaphor only adds props, staging and mood — it never overrides them.
- Convey meaning through what is visibly in the frame; describe only the scene, WITHOUT "symbolizing/representing" clauses. Follow this profile's own rule on whether any text may appear in the image.
- Vary camera framing/angle across neighboring scenes for rhythm.
- If a line is ALREADY concrete (a specific action, place or event), depict it directly — do not force a metaphor.
- Reuse a small set of recurring motifs within one video for cohesion.
`;

async function genVideoLogline(force){
  const script = (state.script || '').trim();
  if (!script) return state.videoLogline || '';
  // Chữ ký kịch bản → đổi kịch bản thì logline cũ coi như hết hạn, tự sinh lại.
  // Logline cũ còn dấu < > = rác (AI chép lại đề bài) → cũng coi là hết hạn để sinh lại.
  const sig = script.length + '|' + script.slice(0, 60);
  const looksReal = state.videoLogline && state.videoLogline.trim() && !/[<>]/.test(state.videoLogline);
  const fresh = looksReal && state.videoLoglineSig === sig;
  if (!force && fresh) return state.videoLogline;
  const p = getProfile();
  const ngach = p && p.ngach ? p.ngach : '';
  const prompt = `Đọc kịch bản video dưới đây và VIẾT LOGLINE tóm tắt TOÀN VIDEO (để mọi cảnh bám đúng chủ đề khi tạo ảnh).
${ngach ? 'Ngách kênh: ' + ngach + '\n' : ''}Yêu cầu: 2-4 câu tiếng Việt — nội dung/câu chuyện chính + nhân vật xuyên suốt + bối cảnh & thời đại + tông cảm xúc. Cụ thể, gọn. KHÔNG liệt kê từng cảnh, KHÔNG kể tuần tự.
⚠️ VIẾT LOGLINE THẬT từ kịch bản — TUYỆT ĐỐI KHÔNG chép lại câu yêu cầu trên, KHÔNG để dấu < >.
VD đúng: {"logline":"Hành trình một cậu bé Hy Lạp cổ đại bị bán làm nô lệ sau chiến tranh, từ làng quê tới khu chợ buôn người ở thế giới cổ đại. Tông bi tráng, hoài niệm."}

Trả về CHỈ 1 JSON object: {"logline":"..."}

KỊCH BẢN:
"""
${script.slice(0, 6000)}
"""`;
  try {
    const o = await callLLMJson(prompt, {
      maxTokens: 400,
      // Chặn AI chép lại đề bài: phải đủ dài, không có dấu < >, không chứa cụm meta của yêu cầu
      validate: o => {
        if (!o || typeof o.logline !== 'string') return false;
        const s = o.logline.trim();
        return s.length >= 25 && !/[<>]/.test(s)
          && !/KHÔNG\s+liệt kê|nội dung\/câu chuyện|2-4 câu tiếng Việt|câu tiếng Việt:/i.test(s);
      }
    });
    state.videoLogline = o.logline.trim();
    state.videoLoglineSig = sig;
    const el = document.getElementById('videoLogline');
    if (el) el.value = state.videoLogline;
    saveState();
    return state.videoLogline;
  } catch (e) {
    console.warn('genVideoLogline:', e.message);
    return state.videoLogline || '';
  }
}

// === L?: const _laThuc ===
const _laThuc = (s) => !!(s && (s.wantStock || s.wantYt || s.wantKho || s.wantWeb));

// === L?: const T2_TUY_CHON ===
const T2_TUY_CHON = {
  highDetail: false,
  hybridIcon: false,
  autoVerify: false,
};

// === L?: function buildSceneGenPrompt ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=26142c, shared=24339c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function buildSceneGenPrompt(batch, prevSceneCtx, p, profileContext, neighborVO){
  const _ssClean = _cleanSceneStyle(p.sceneStyle);   // dùng thay p.sceneStyle ở các cụm aesthetic
  /* ── Cảnh dùng TƯ LIỆU CÓ SẴN phải viết kiểu khác hẳn ──────────────────
     Style profile (tông màu, chất liệu vẽ, ánh sáng dàn dựng, nhân vật khoá
     theo ảnh tham chiếu) chỉ có nghĩa khi ẢNH DO AI VẼ. Đem nguyên bộ đó đi
     tìm clip có sẵn thì hỏng cả hai đầu: không kho nào có "flat-2D teal
     palette", mà từ khoá lại bị nhấn chìm dưới đống chữ tả tông màu.
     Với cảnh có ⚑ thì "prompt" đổi vai: nó là MÔ TẢ ĐỂ ĐI TÌM, không phải
     lệnh vẽ.                                                               */
  const _coThucBatch = (Array.isArray(batch) ? batch : []).some(_laThuc);
  const luatThuc = _coThucBatch ? `

⚑ CẢNH CÓ NHÃN "TƯ LIỆU THẬT" — VIẾT KHÁC HẲN:
- Những cảnh này KHÔNG sinh ảnh AI. Chúng sẽ được lấp bằng clip/ảnh QUAY THẬT từ kho tư liệu.
- Với các cảnh đó, "prompt" KHÔNG phải lệnh vẽ mà là MÔ TẢ ĐỂ ĐI TÌM: 6–14 từ tiếng Anh, chỉ gồm
  DANH TỪ CỤ THỂ + HÀNH ĐỘNG có thật (vd "capuchin monkey cracking nut with stone",
  "archaeologist brushing soil at excavation trench").
- ⛔ TUYỆT ĐỐI KHÔNG đưa vào: tông màu, phong cách vẽ, chất liệu (2D/3D/watercolor/render),
  ánh sáng dàn dựng, tên nhân vật [slug], hay bất kỳ chữ nào của Style Profile. Không kho tư liệu
  nào tìm được theo tông màu, và những chữ đó chỉ làm loãng từ khoá.
- Cảnh KHÔNG có nhãn thì giữ nguyên mọi luật ảnh AI bên dưới.` : '';
  const _pmScene = _profileMedium(p);                 // Profile trống thì bám medium suy ra được, KHÔNG mặc định 2D
  // Công thức hình theo KIỂU CẢNH — lượt 1 chỉ chọn kiểu, lượt này mới cần công thức để viết prompt.
  const _shotRecipes = _sceneTypesOn().map(t => `  • ${t}: ${SCENE_TYPES[t].recipe}`).join('\n');
  const highDetail = T2_TUY_CHON.highDetail;
  // Hai chế độ ĐỘC LẬP: shortMode = nhân vật do ảnh reference lo (đồng nhất); highDetail = môi trường tả dày.
  // Bật CẢ HAI = nhân vật khoá theo reference + bối cảnh chi tiết.
  // Ô shortPromptMode cũng đã gỡ. Không sao: refShape bên dưới vẫn TRUE nhờ
  // descMode mặc định 'tag' → hành vi không đổi.
  const shortMode = false;
  // refShape = nhân vật do ẢNH REFERENCE gánh → prompt NGẮN, KHÔNG nhồi body-lock/NOT-list (đúng Bản 1 Nano Banana).
  // Chế độ tag ([tên-nhân-vật] + reference sheet) mặc định coi là có ref → luôn dùng shape ngắn.
  const refShape = shortMode || (state.descMode || 'tag') === 'tag';
  const noCharMode = document.getElementById('noCharMode')?.checked;
  const _brollEl = document.getElementById('brollMode');   // ô tick đã gỡ khỏi UI redesign → không có ô = BẬT (mặc định cũ)
  const brollMode = (_brollEl ? _brollEl.checked : true) || noCharMode;
  // 🧩 Style lai: cảnh kể = người que + bối cảnh, cảnh giải thích = icon nền trắng
  const hybridIconMode = T2_TUY_CHON.hybridIcon && !noCharMode;
  const hybridRule = hybridIconMode ? `
🧩 STYLE LAI — TÁCH 2 KIỂU CẢNH (LUẬT BẮT BUỘC, quyết theo nội dung VO):
1) Cảnh KỂ CHUYỆN (VO là hành động/cảm xúc/lời kể của NGƯỜI) → vẽ NHÂN VẬT (người que của kênh) trong BỐI CẢNH đầy đủ theo Scene Style.
2) Cảnh GIẢI THÍCH (VO giải thích khái niệm / quy trình / so sánh / số liệu / nguyên nhân-kết quả, KHÔNG phải hành động của nhân vật) → vẽ ICON / PICTOGRAM line-art ĐƠN GIẢN, nét đen đậm, kiểu biểu tượng, trên NỀN TRẮNG TRƠN (plain solid white background). KHÔNG nhân vật người que, KHÔNG bối cảnh phòng/cảnh vật. Mỗi cảnh 1–4 icon, tối giản, nhiều khoảng trắng.
   - Prompt loại này PHẢI ghi rõ: "minimalist black line-art pictogram icons on a plain solid white background, no scenery, no characters, lots of negative space".
- Tự quyết mỗi cảnh thuộc loại nào theo VO. Đa số câu kể → kiểu 1; câu giải thích/khái niệm → kiểu 2.
` : '';
  // 🏺 Khoá thời đại cho prompt cảnh: ưu tiên giá trị đã đặt ở Tool 3 (state.t3Era), nếu trống → trích kịch bản
  const eraHintT2 = (state.t3Era && state.t3Era.trim())
    ? state.t3Era.trim()
    : (state.script || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  const eraBlockT2 = eraHintT2
    ? `\n🏺 BỐI CẢNH & THỜI ĐẠI (áp cho MỌI cảnh): ${eraHintT2}\n- Trang phục, kiểu tóc/đội đầu và đạo cụ của MỌI nhân vật — kể cả nhân vật phụ tả tự do, đám đông, người qua đường — PHẢI đúng thời đại/bối cảnh này; KHÔNG để lẫn đồ/tóc hiện đại sai thời. GIỮ NGUYÊN art-style/phong cách render của kênh (theo Character/Scene Style) ở mọi nhân vật — chỉ đổi trang phục/tóc/đạo cụ cho khớp thời đại.\n`
    : '';
  // 🎬 Cảnh b-roll / 🚫 không nhân vật
  const brollRule = noCharMode ? `
🚫 VIDEO KHÔNG CÓ NHÂN VẬT (HƯỚNG DẪN / B-ROLL THUẦN) — LUẬT TỐI CAO, ÁP CHO MỌI CẢNH:
- TUYỆT ĐỐI KHÔNG có người, không nhân vật, không người dẫn, không bóng người, không khuôn mặt trong BẤT KỲ cảnh nào.
- MỌI cảnh chỉ là: cảnh vật / đồ vật / quá trình / cận cảnh (close-up, macro) / dụng cụ / sơ đồ đơn giản.
- VO tả hành động của người → chuyển thành cảnh THỂ HIỆN ĐỒ VẬT / KẾT QUẢ / QUÁ TRÌNH, KHÔNG hiện người. VD: "you water the plants" → "close-up of a watering can pouring water onto green seedlings, no person"; câu cảm xúc/đại từ ("she smiles") → thay bằng cảnh vật liên quan trong ngữ cảnh.
- BỎ QUA hoàn toàn phần phân loại NHÂN VẬT bên dưới.
- MỖI prompt PHẢI kết thúc kèm cụm: "no people, no person, no humans, no figures, no hands".
` : (brollMode ? `
🎬 KHÔNG phải cảnh nào cũng có người — TỰ QUYẾT theo nội dung VO:
- VO nói về NGƯỜI (hành động, lời người dẫn, cảm xúc, đối thoại) → cảnh CÓ nhân vật.
- VO tả ĐỒ VẬT / NƠI CHỐN / QUÁ TRÌNH / CẬN CẢNH chi tiết / hiện tượng cụ thể (vd "ants on a leaf", "the vegetable bed", "a jar of baking soda", "roots in the soil", "rain falling") → làm cảnh B-ROLL / INSERT / CẬN CẢNH chỉ có đồ vật + bối cảnh, KHÔNG có người, KHÔNG có người dẫn nhìn camera.
- Mục tiêu: XEN KẼ cảnh có người và cảnh b-roll cho video tự nhiên — KHÔNG ép người dẫn vào mọi khung hình.
- ⚠️ QUAN TRỌNG: cảnh có thể đã được GÁN SẴN 1 nhân vật ("nhân vật:" ở dòng cảnh), NHƯNG nếu VO của cảnh đó là TẢ ĐỒ VẬT / KHÁI NIỆM / ẨN DỤ / câu trừu tượng (không phải hành động cụ thể của chính nhân vật đó) → ĐƯỢC PHÉP bỏ người, làm cảnh B-ROLL/INSERT đồ vật, KHÔNG bắt buộc chèn tag [nhân-vật] đã gán. Tag nhân vật chỉ là gợi ý, không phải lệnh cứng khi b-roll.
- Cảnh b-roll vẫn giữ đúng style/tông màu/ánh sáng của kênh; mô tả rõ chủ thể, góc máy (close-up/macro/wide), bố cục.
` : '');
  // ---- Mode-aware: Tag / Inline / Inline+bible ----
      const dm = state.descMode || 'tag';
      let charCtx, bgCtx, charHeader, bgHeader, mode1Rule;
      if (dm === 'inline_bible') {
        charCtx = state.charactersV.map(c => `- ${c}: ${(state.charBible && state.charBible[c]) || '(chưa có hồ sơ — bấm Quét Trước)'}`).join('\n');
        bgCtx = state.backgroundsV.map(b => `- ${b}: ${(state.bgBible && state.bgBible[b]) || '(chưa có hồ sơ)'}`).join('\n');
        charHeader = 'NHÂN VẬT — CHÈN NGUYÊN VĂN mô tả cố định sau vào prompt (KHÔNG đổi chữ, KHÔNG dùng ngoặc vuông):';
        bgHeader = 'BỐI CẢNH — CHÈN NGUYÊN VĂN mô tả cố định sau:';
        mode1Rule = `- Tư thế/biểu cảm/hành động: tả theo VO
- Nhân vật là NGƯỜI: CHÈN NGUYÊN VĂN mô tả cố định của nhân vật đó (ở danh sách trên) vào prompt, KHÔNG đổi 1 chữ, KHÔNG ngoặc vuông → giữ nhân vật giống hệt mọi cảnh. VD: "a tired female nurse, mid-30s, mint-green scrubs, brown hair in low bun, stands at the desk..."
- Động vật/vật thể: miêu tả bình thường
- Bối cảnh: CHÈN NGUYÊN VĂN mô tả cố định của bối cảnh đó`;
      } else if (dm === 'inline') {
        charCtx = state.charactersV.map(c => '- ' + c).join('\n');
        bgCtx = state.backgroundsV.map(b => '- ' + b).join('\n');
        charHeader = 'NHÂN VẬT (gợi ý vai — TẢ ĐẦY ĐỦ ngoại hình trong prompt):';
        bgHeader = 'BỐI CẢNH (gợi ý):';
        mode1Rule = `- Tư thế/biểu cảm/hành động: tả theo VO
- Nhân vật là NGƯỜI: TẢ ĐẦY ĐỦ ngoại hình NGAY trong prompt (tuổi, giới, trang phục+màu, tóc, đặc điểm), KHÔNG dùng ngoặc vuông. VD: "a young male agent in a grey suit, short black hair, stands at the desk..."
- Nếu cùng 1 nhân vật xuất hiện nhiều cảnh: tả GIỐNG NHAU mỗi lần để nhất quán
- Động vật/vật thể: miêu tả bình thường
- Bối cảnh: TẢ ĐẦY ĐỦ bối cảnh trong prompt (KHÔNG ngoặc vuông)`;
      } else {
        charCtx = state.charactersV.map(c => '- ' + c).join('\n');
        bgCtx = state.backgroundsV.map(b => '- ' + b).join('\n');
        charHeader = 'NHÂN VẬT CÓ REFERENCE SHEET (ghi tag [tên]):';
        bgHeader = 'BỐI CẢNH (reference từ sheet):';
        mode1Rule = `- Nhân vật CÓ trong danh sách trên: ghi [tên-nhân-vật] (VD: "[narrator] stands at desk...")
- Nhân vật PHỤ KHÔNG có trong danh sách (xuất hiện trong VO nhưng chưa có reference): TẢ TỰ DO ngoại hình ngắn gọn theo style chính của kênh — VD nếu cảnh có người lạ, người qua đường, đám đông → mô tả "a [mô tả ngắn] character in same art style" KHÔNG dùng ngoặc vuông
- Nếu cảnh có NHIỀU nhân vật: ghi đủ cả nhân vật chính (tag) lẫn phụ (tả tự do). VD: "[narrator] talking to a worried elderly woman in plain dress, both in same cartoon style, inside [office-night]"
- Động vật/vật thể: miêu tả bình thường KHÔNG ngoặc vuông
- Bối cảnh: ghi [tên-bối-cảnh] (VD: "inside [dark-office-night]...")
- Style nhân vật phụ phải KHỚP style nhân vật chính (cùng nét vẽ, cùng tỉ lệ)`;
      }
      // Detect animation/cartoon style → inject formula block
      const styleStr = (p.sceneStyle || '').toLowerCase();
      const isCartoon2D = /cartoon|flat|2d|animation|hand.drawn|stick|explainer|educational/.test(styleStr);
      // Lấy mô tả nhân vật NGẮN GỌN từ characterStyle của Profile (không hardcode)
      // Ưu tiên "Đặc điểm nhận dạng" (1 dòng do user đặt) → lặp gọn mỗi cảnh, không bloat prompt.
      // Nếu trống → lấy 600 ký tự đầu Character Style (đủ chứa đặc điểm cốt lõi như stick-limb; trước đây cắt 280 nên mất).
      const charStyleShort = ((p.charIdentity && p.charIdentity.trim())
        ? p.charIdentity.trim()
        : _trimToSentence((p.characterStyle || '').replace(/\s+/g, ' ').trim(), 600));
      const animFormulaBlock = (isCartoon2D && refShape) ? `
🎬 STYLE DO ẢNH REFERENCE GÁNH (BẢN 1 — cảnh có [tên-nhân-vật] = có ảnh reference đính kèm khi tạo ảnh):
- TUYỆT ĐỐI KHÔNG tả lại toàn bộ ngoại hình / tỉ lệ cơ thể / nét vẽ nhân vật trong prompt (ảnh reference ĐÃ khoá những cái đó — tả lại sẽ ĐÁNH NHAU với ref). Chỉ ghi [tên-nhân-vật] + hành động/biểu cảm theo VO.
- Prompt viết NGẮN GỌN theo shape Nano Banana: [chủ thể + hành động] tại [bối cảnh] → [góc máy] → [ánh sáng/không khí] → KẾT bằng 1 cụm scene aesthetic NGẮN dương tính (vd "${_ssClean || _pmScene.medium || 'consistent cinematic style, cohesive lighting'}").
- KHÔNG danh sách NOT/no (trừ "no text, no watermark" ở cuối). Diễn đạt DƯƠNG TÍNH.
- Nhân vật phụ KHÔNG có ảnh reference: tả NGẮN ngoại hình theo đúng style kênh.
` : (isCartoon2D ? `
🎬 STYLE MASTER Ở CUỐI (BẢN 2 — KHÔNG có ảnh reference, tự tả style ở cuối prompt):
ÁP CÔNG THỨC HÌNH theo "kiểu" của từng cảnh (KHÔNG ghi tên kiểu vào prompt):
${_shotRecipes}
⛔ KHÔNG viết cụm phong cách/aesthetic ở cuối prompt — hệ thống TỰ gắn cụm chuẩn giống hệt nhau cho mọi cảnh. Chỉ tả nội dung hình.
⛔ KHÔNG mô tả CHỮ, SỐ, nhãn, bảng hiệu, tiêu đề ĐỌC ĐƯỢC trong ảnh (không "labeled '35'", không "screen reads DEVALUATION"). Muốn thể hiện số liệu thì diễn bằng SỐ LƯỢNG/kích thước/độ cao/độ dày của vật thể — vd 'một chồng vali cao ngất so với một chiếc lẻ loi' thay vì ghi con số.
- Viết prompt theo shape: [chủ thể + hành động] tại [bối cảnh] → [góc máy] → [ánh sáng] → rồi CUỐI cùng chèn 1 câu STYLE dương tính gói gọn đặc điểm nhân vật + nét vẽ (dựa trên: "${charStyleShort || 'style nhân vật của kênh'}").
- Diễn đạt DƯƠNG TÍNH, KHÔNG danh sách NOT (chỉ giữ no text, no watermark ở cuối).
` : '');

      // 🎯 Logline toàn video — áp cho MỌI cảnh để không lạc chủ đề / không đứt mạch giữa batch
      const loglineBlock = (state.videoLogline && state.videoLogline.trim())
        ? `\n🎯 BỐI CẢNH TOÀN VIDEO (mọi cảnh PHẢI bám vào đây):\n"${state.videoLogline.trim()}"\n- Mọi cảnh — kể cả cảnh trừu tượng / câu hỏi tu từ / câu chuyển ý — phải nằm trong THẾ GIỚI HÌNH ẢNH của video này (đúng nhân vật, bối cảnh, thời đại, tông màu nêu trên). KHÔNG vẽ hình generic lạc khỏi câu chuyện.\n`
        : '';
      const prompt = `Bạn là prompt engineer G-Labs (Imagen / Nano Banana). Tạo prompt cảnh cho mỗi cảnh bên dưới.

PROFILE KÊNH:
${profileContext}
${loglineBlock}
SCENE AESTHETIC (dùng cho MỌI cảnh): "${_ssClean || 'consistent visual style across all scenes'}"

ĐỊNH HƯỚNG LOOK (diễn đạt DƯƠNG TÍNH trong prompt — KHÔNG chép nguyên thành danh sách "no/not"; chỉ giữ vài negative thật cần như no text, no watermark): "${p.promptRules || ''}"
${eraBlockT2}${animFormulaBlock}

${charHeader}
${charCtx || '(không có)'}
${(state.wardrobe && Object.keys(state.wardrobe).length) ? ('\n👕 TỦ ĐỒ CỐ ĐỊNH (BẮT BUỘC dán ĐÚNG "desc" — KHÔNG tự chế đồ khác, cùng giai đoạn mặc GIỐNG NHAU):\n' + Object.entries(state.wardrobe).map(([n, os]) => `  • [${n}]: ${(os || []).map(o => `khi ${o.when} → "${o.desc}"`).join(' · ')}`).join('\n')) : ''}

${bgHeader}
${bgCtx || '(không có)'}

Với mỗi cảnh, TRƯỚC TIÊN xác định LOẠI CẢNH từ nội dung VO, sau đó viết prompt phù hợp:
${hybridRule}${brollRule}${VISUAL_METAPHOR_RULE}
🔹 LOẠI 1 — NHÂN VẬT TRONG BỐI CẢNH (VO nói về hành động của người):
${mode1Rule}

🔹 LOẠI 2 — INFOGRAPHIC / BIỂU ĐỒ ĐƠN GIẢN (VO nói về số liệu, so sánh, thống kê):
- Vẽ ĐƠN GIẢN: 1-2 icon/biểu đồ đơn giản + nhân vật ${dm === 'tag' ? '[tên-nhân-vật]' : 'đơn giản ĐÚNG STYLE KÊNH (KHÔNG mặc định người que)'} chỉ tay hoặc đứng cạnh
- Vẽ ĐƠN GIẢN, KHÔNG nhiều panel. GHI CHỮ/SỐ THẬT vào biểu đồ (tiêu đề + vài nhãn NGẮN 1-4 từ / con số ĐÚNG, khớp nội dung VO, viết đúng chính tả) — TUYỆT ĐỐI KHÔNG để ô nhãn TRỐNG / "[TEXT]" / "reserved caption". Giữ chữ NGẮN để model vẽ rõ.
- KHÔNG vẽ nội tạng, ký hiệu y tế trừ khi VO yêu cầu rõ ràng
- VD: "${dm === 'tag' ? '[narrator-male]' : 'A simple character in the channel art style'} pointing at a simple bar chart with 3 labelled bars — \\"Storage 20\\", \\"Mall 12\\", \\"Office 8\\" written under them, title \\"Cost per month\\" on top; clean flat background, minimal style, short real text spelled correctly"

🔹 LOẠI 3 — QUY TRÌNH / BƯỚC (VO giải thích cách làm, từng bước):
- Mô tả 2-3 bước từ trái sang phải với mũi tên đơn giản
- ${dm === 'tag' ? 'Nếu có nhân vật: ghi [tên-nhân-vật] thực hiện hành động' : 'Nhân vật đơn giản (ĐÚNG STYLE KÊNH) thực hiện từng bước'}
- VD: "Three steps left to right with arrows: step 1 seed icon, step 2 watering can icon, step 3 plant sprouting, warm muted palette, flat 2D style"

🔹 LOẠI 4 — ICON / KHÁI NIỆM (VO giải thích khái niệm trừu tượng):
- 1 icon trung tâm lớn + tối đa 4 icon phụ xung quanh, kiểu simple flat illustration
- Dùng metaphor hình ảnh (não = suy nghĩ, tim = cảm xúc, ví tiền = tài chính)
- KHÔNG vẽ nhân vật realistic, KHÔNG vẽ nội tạng người trừ khi VO nói về y tế cụ thể
- ${dm === 'tag' ? 'Nếu có nhân vật phụ: ghi [tên-nhân-vật] đứng cạnh icon' : 'Nếu có người: vẽ nhân vật đơn giản ĐÚNG STYLE KÊNH (KHÔNG mặc định người que)'}
- VD: "Central large coin icon surrounded by 4 small flat icons: house, car, graduation cap, piggy bank, connected by dotted lines, warm yellow background, flat 2D style"

🔹 LOẠI 5 — SỐ/TỪ KHOÁ ẤN TƯỢNG + MINH HOẠ (CHỈ khi VO có con số sốc, năm cụ thể, hoặc 1 từ khoá duy nhất):
- CHỈ dùng cho text 1-4 TỪ ngắn, KHÔNG dùng cho câu trần thuật/đối thoại
- Text ngắn bold ở trên/giữa + hình minh hoạ đơn giản bên dưới
- VD: "Bold black text '13,000 YEARS' at top center, below a simple flat illustration of ancient cave with campfire, warm earthy palette, flat 2D style"
- KHÔNG dùng LOẠI 5 nếu VO là câu kể chuyện — chọn LOẠI 1 (nhân vật) hoặc LOẠI 4 (icon khái niệm)

QUY TẮC CHUNG:
- Luôn mô tả BỐ CỤC KHÔNG GIAN (trái/phải/trên/dưới/giữa)
- 🎬 ÁNH SÁNG CÓ CHỦ ĐÍCH theo CẢM XÚC VO (đừng để phẳng/đều mọi cảnh): căng/sợ → ngược sáng gắt, bóng mạnh, tương phản cao; ấm/hoài niệm → golden hour, nắng xiên mềm; buồn/tĩnh → xanh lạnh, khuếch tán; vui/hy vọng → sáng trong, rực; bí ẩn → tối chủ đạo + 1 vệt sáng điểm. Ghi rõ nguồn sáng + hướng + không khí.
- 🧭 CHIỀU SÂU & BỐ CỤC: dựng lớp tiền cảnh–trung cảnh–hậu cảnh cho có không gian; đặt chủ thể theo quy tắc 1/3, dùng đường dẫn/phối cảnh dẫn mắt về chủ thể; "close-up" ưu tiên phông mờ nhẹ (độ sâu trường ảnh nông) để tách chủ thể.
- Kết thúc bằng scene aesthetic tag

⚠️ TEXT TRONG ẢNH — RẤT QUAN TRỌNG (ĐA SỐ CẢNH KHÔNG NÊN CÓ TEXT):
- MẶC ĐỊNH: KHÔNG có text trong ảnh. Để hình ảnh tự kể chuyện qua nhân vật, icon, bố cục.
- CHỈ thêm text khi thật cần điểm nhấn: con số ('8 HOURS'), năm ('1965'), 1 từ khoá ('WARNING', 'DANGER')
- GIỚI HẠN CỨNG: text trong ảnh tối đa 4 TỪ. Viết HOA, trong nháy đơn.
- TUYỆT ĐỐI KHÔNG đưa cả câu VO, câu thoại, hay tiêu đề dài vào ảnh (vd KHÔNG ghi 'SKIP SEVERAL NIGHTS? THE STREETS STOP WORKING' hay 'SLEEP IS WHEN THE CLEANUP HAPPENS')
- TUYỆT ĐỐI KHÔNG dịch nguyên VO sang tiếng Anh để làm text — text chỉ là điểm nhấn cực ngắn, không phải tiêu đề câu
- 🌐 NGÔN NGỮ TEXT: CHỈ TIẾNG ANH. TUYỆT ĐỐI KHÔNG có chữ Hàn, Trung, Nhật, Thái, Ả Rập, hay bất kỳ ngôn ngữ nào khác. Phải ghi rõ trong prompt: "all text in English only, no Korean / Chinese / Japanese characters"
- LOẠI 4 ICON CONCEPT: icon dùng METAPHOR HÌNH ẢNH thuần (não, đồng hồ, biểu tượng) — KHÔNG dán label chữ dưới mỗi icon (đây là lỗi thường gặp: AI mặc định thêm label Hàn dưới icon health/medical)

🔗 LIÊN TỤC HÌNH ẢNH (để video KHÔNG rời rạc — rất quan trọng):
- Đây là các cảnh LIÊN TIẾP trong CÙNG 1 video → giữ mạch hình ảnh liền lạc.
- Cảnh liên tiếp CÙNG bối cảnh → giữ KHÔNG GIAN nhất quán (cùng phòng, cùng layout, cùng hướng ánh sáng), chỉ đổi góc máy/hành động.
- Đổi góc máy CÓ CHỦ ĐÍCH (vd wide → medium → close để dẫn dắt), KHÔNG nhảy góc ngẫu nhiên giữa các cảnh.
- Cùng 1 phân đoạn nội dung → tông màu + ánh sáng + bố cục phải nối tiếp mượt với cảnh trước, không đổi đột ngột.
${prevSceneCtx ? '\n📍 CẢNH NGAY TRƯỚC (cảnh đầu tiên bên dưới phải nối tiếp mượt với cảnh này):\n"' + prevSceneCtx + '"\n' : ''}
${neighborVO ? `\n🔗 NGỮ CẢNH LÂN CẬN (lời thoại cảnh trước & sau — DÙNG để hiểu bối cảnh nếu cảnh hiện tại thiếu hình ảnh):\n${neighborVO}\n
⚠️ Nếu lời thoại của cảnh hiện tại KHÔNG có hình ảnh cụ thể (câu hỏi tu từ, câu chuyển ý, câu trừu tượng như "what does it feel like?", "hold that feeling", "here's the thing") → HÃY mượn bối cảnh/nhân vật/không khí từ cảnh trước hoặc cảnh sau để vẽ 1 hình hợp lý, liền mạch. KHÔNG để prompt trống rỗng hay quá chung chung. Hình phải nối tiếp tự nhiên với mạch truyện.` : ''}
⚠️ TUYỆT ĐỐI KHÔNG:
- KHÔNG ghi "LOẠI 1", "LOẠI 2", "LOẠI 3", "LOẠI 4", "LOẠI 5" vào prompt output
- KHÔNG ghi "Type 1", "Type 2", ... hay bất kỳ label phân loại nào
- KHÔNG ghi "[001]", "[002]" hay chỉ số cảnh vào prompt
${dm === 'tag' ? '- LUÔN dùng [tên-nhân-vật] và [tên-bối-cảnh] cho MỌI cảnh có nhân vật — KHÔNG tả inline\n- VD đúng: "[narrator-male] walks in [outdoor-nature-daytime]" | VD SAI: "a generic character walks in a green field"\n' : '- KHÔNG dùng ngoặc vuông [] cho tên nhân vật/bối cảnh — TẢ THẲNG bằng chữ tiếng Anh\n'}- Loại cảnh CHỈ DÙNG ĐỂ AI XÁC ĐỊNH STYLE INTERNAL, KHÔNG XUẤT HIỆN trong text prompt cuối cùng
- Prompt trả về phải BẮT ĐẦU NGAY bằng mô tả visual (vd: "Medium shot of...", "Split layout showing...", "Wide angle of..."), KHÔNG có prefix nào khác

📐 CÔNG THỨC NANO BANANA (Google DeepMind — model instruction-following dựng trên Gemini, viết prompt THEO ĐÚNG shape này):
- THỨ TỰ: [Chủ thể + tính từ cụ thể] đang [hành động] tại [bối cảnh] → [bố cục/góc máy] → [ánh sáng/không khí] → [phong cách/nét vẽ để GẦN CUỐI]. Đưa CHỦ THỂ–HÀNH ĐỘNG–BỐI CẢNH lên ĐẦU, phong cách/aesthetic xuống CUỐI (KHÔNG front-load style).
- DƯƠNG TÍNH: tả thứ MUỐN thấy, HẠN CHẾ tối đa "no X / not Y" (model này không dùng negative prompt kiểu SDXL). Vd "clean plain white background" thay vì "no clutter/no background"; "empty street" thay vì "no cars". Chỉ giữ vài negative thật cần: no text, no watermark (+ no people cho b-roll). ⚠️ NGOẠI LỆ: cảnh INFOGRAPHIC / BIỂU ĐỒ / SO SÁNH / BẢN ĐỒ thì ĐƯỢC & NÊN ghi CHỮ/SỐ thật ngắn (tiêu đề + nhãn 1-4 từ / con số đúng) — với cảnh đó KHÔNG thêm "no text".
- NGÔN NGỮ TỰ NHIÊN, mạch lạc, câu đầy đủ — KHÔNG nhồi từ khoá rời rạc cách nhau bằng dấu phẩy.
- KHÔNG ghi "--ar" hay tỉ lệ khung vào prompt (tool đã set tỉ lệ riêng qua API).

🛡 AN TOÀN NỘI DUNG (BẮT BUỘC — để qua bộ lọc của tool tạo ảnh):
Tool tạo ảnh (G-Labs) TỪ CHỐI các prompt có nội dung chết chóc/bạo lực/thương vong trực tiếp. Khi VO nhắc đến chết, chìm, đóng băng, thi thể, nạn nhân, máu, đau đớn... PHẢI viết prompt theo cách GIÁN TIẾP, ẩn dụ, tập trung KHÔNG KHÍ thay vì hành động:
- "drowning / chết đuối" → "floating in dark water looking up, peaceful, eyes closed"
- "dead body / thi thể" → "figure drifting gently in deep water, calm, distant"
- "freezing to death / chết cóng" → "shivering, breath visible, wrapped in cold blue tones"
- "1,500 victims died / hàng nghìn người chết" → "vast empty dark ocean, scattered distant lights, somber mood" (KHÔNG vẽ người chết, KHÔNG số liệu thương vong)
- "blood / máu, gore" → bỏ hoàn toàn, thay bằng không khí u tối
- TUYỆT ĐỐI KHÔNG dùng các từ: dead, death, dying, corpse, drowning, blood, gore, victim, suffering trong prompt tiếng Anh
- Thay bằng: peaceful, drifting, floating, cold, somber, quiet, still, distant, fading
- Giữ ĐÚNG cảm xúc và không khí của cảnh, chỉ đổi cách diễn đạt để không vi phạm

Ngôn ngữ prompt: TIẾNG ANH (cho image gen). ${refShape && highDetail ? '70-130 từ/prompt (nhân vật để ảnh reference lo, MÔI TRƯỜNG tả dày chi tiết).' : refShape ? '55-110 từ/prompt (nhân vật CHỈ tag — ảnh reference lo ngoại hình, KHÔNG tả lại body-lock; DỒN chữ vào tả MÔI TRƯỜNG/bối cảnh chi tiết + ánh sáng (hướng/màu/tương phản) + bố cục & CHIỀU SÂU → prompt GIÀU CHI TIẾT, ĐIỆN ẢNH, chỉ gọn ở phần nhân vật).' : highDetail ? '90-160 từ/prompt (CHI TIẾT CAO).' : '60-120 từ/prompt.'}
${highDetail ? `
🔍 CHẾ ĐỘ CHI TIẾT CAO — làm ảnh DÀY chi tiết như tranh minh hoạ kể chuyện:
- ĐẠO CỤ TIỀN CẢNH: gọi tên 3-6 vật cụ thể trong cảnh (vd thùng gỗ, dây thừng cuộn, vò gốm, đuốc, bàn thợ, vũ khí treo tường, sạp hàng) — KHÔNG để nền trống.
- VẬT LIỆU & TEXTURE: ghi chất liệu bề mặt (gỗ sờn, đồng tán đinh, đá rêu, vải lanh, kim loại gỉ, vữa nứt) để ảnh có độ dày.
- LỚP CHIỀU SÂU: tả riêng tiền cảnh / trung cảnh / hậu cảnh (vd hậu cảnh có núi xa, cột đền, tàu thuyền, mái nhà, đám đông mờ) để tạo depth.
- ÁNH SÁNG CỤ THỂ: nguồn sáng + hướng + màu (vd "warm torchlight from the left casting long shadows", "overcast grey daylight from above").
- Vẫn giữ ĐÚNG art-style của kênh (nét vẽ, tỉ lệ nhân vật, bảng màu) — chỉ thêm chi tiết MÔI TRƯỜNG, KHÔNG đổi style nhân vật.
- Thêm chi tiết nhưng VẪN giữ luật NO-TEXT ở trên — KHÔNG thêm chữ/label vào ảnh.
` : ''}${shortMode ? `
⚡ CHẾ ĐỘ PROMPT NGẮN (người dùng sẽ ĐÍNH ẢNH REFERENCE của nhân vật khi gen):
- KHÔNG mô tả ngoại hình nhân vật chi tiết (KHÔNG tả đầu tròn, mắt, tay chân, tóc, quần áo, tỉ lệ cơ thể) — ảnh reference đã lo việc đó
- CHỈ ghi: [tên-nhân-vật] + HÀNH ĐỘNG + TƯ THẾ + cảm xúc (vd: "[passenger-bunk] lying on bunk staring at ceiling, worried")
- TẬP TRUNG mô tả: bối cảnh, ánh sáng, góc máy, tông màu, không khí
- KHÔNG nhắc lại đặc điểm style nhân vật — để reference image quyết định
- Vẫn giữ mô tả style chung cho MÔI TRƯỜNG (flat 2D, màu sắc, outline) nhưng KHÔNG áp lên nhân vật
` : ''}

${luatThuc}

⚠️ VIẾT ĐẦY ĐỦ prompt RIÊNG cho TỪNG cảnh trong danh sách — KHÔNG được lười:
- KHÔNG dùng "...", "...full prompt...", "[full prompt]", "same as above", "như cảnh trước", "tương tự".
- KHÔNG bỏ trống, KHÔNG viết tắt. Mỗi cảnh PHẢI có 1 prompt hoàn chỉnh độc lập, đủ chữ.

Trả về CHỈ JSON array (mỗi cảnh 1 phần tử ĐẦY ĐỦ):
[{"id":"001","prompt":"<prompt hoàn chỉnh>"}, ...]

CÁC CẢNH:
${batch.map(s => `[${s.id}] VO: "${s.text}" | nhân vật: ${s.character || '-'} | bối cảnh: ${s.background || '-'} | camera: ${s.camera} | ${s.duration}s${_laThuc(s) ? ' | ⚑ TƯ LIỆU THẬT' : ''}`).join('\n')}`;
  return prompt;
}

async function genSingleScenePrompt(id){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  await genVideoLogline(false);
  const scene = state.scenes[idx];
  const profileContext = `Kênh: ${p.tenKenh}\nNgách: ${p.ngach}\nPOV: ${p.povStyle}\nCấu trúc: ${p.cauTruc}`;
  // Lấy cảnh ngay trước làm ngữ cảnh liên tục
  let prevSceneCtx = '';
  if (idx > 0) {
    const prev = state.scenes[idx - 1];
    const pp = state.scenePrompts[prev.id];
    if (pp) prevSceneCtx = `[${prev.id}] ${pp.slice(0, 220)}`;
  }
  // Lời thoại cảnh trước + sau (để mượn bối cảnh nếu cảnh này thiếu hình)
  let neighborVO = '';
  const prevS = state.scenes[idx - 1];
  const nextS = state.scenes[idx + 1];
  if (prevS) neighborVO += `Cảnh trước [${prevS.id}]: "${(prevS.text || '').slice(0, 200)}"\n`;
  if (nextS) neighborVO += `Cảnh sau [${nextS.id}]: "${(nextS.text || '').slice(0, 200)}"`;
  setStatus2(`Đang tạo lại prompt cảnh [${id}]...`, 'working');
  try {
    const prompt = buildSceneGenPrompt([scene], prevSceneCtx, p, profileContext, neighborVO);
    // Thinking OFF + validate (mảng có ít nhất 1 {prompt})
    const vArr = a => Array.isArray(a) && a.some(x => x && x.prompt);
    let parsed = [];
    for (let attempt = 0; attempt < 2 && !parsed.length; attempt++) {
      const reply = await callLLM(prompt, { maxTokens: 1000, _override: { thinking: false } });
      parsed = safeParseJSON(reply, vArr);
    }
    // Lấy prompt đầu tiên trả về (chỉ có 1 cảnh) — không phụ thuộc ID AI trả
    const got = parsed.find(x => x && x.prompt);
    const raw = got ? cleanPrompt(got.prompt) : '';
    if (raw && !_isLazyPrompt(raw)) {
      state.scenePrompts[id] = _ensureSceneTags(raw, scene);
      renderPromptsV();
      setStatus2(`✓ Đã tạo lại prompt cảnh [${id}].`, 'ok');
      saveState();
    } else {
      setStatus2(`⚠️ Cảnh [${id}] AI trả prompt lười/lỗi — bấm 🔧 Tạo lại lần nữa (hoặc đổi Claude).`, 'error');
    }
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function t2RegenAllPrompts(){
  if (typeof gateTool === 'function' && gateTool('tool2')) return;
  const p = getProfile(); if (!p) return setStatus2('Cần Profile trước.', 'error');
  /* Cảnh đã giao cho nguồn tư liệu KHÔNG cần prompt ảnh — bấm "Tạo lại tất cả"
     mà quét cả chúng là đốt lại cả trăm lượt gọi AI cho thứ không ai đọc.     */
  const _tuLieu = (state.scenes || []).filter(_laThuc).length;
  const scenes = (state.scenes || []).filter(s => !_laThuc(s));
  if (!scenes.length) return setStatus2(_tuLieu
    ? `Cả ${_tuLieu} cảnh đều dùng tư liệu có sẵn — không cảnh nào cần prompt ảnh.`
    : 'Chưa có cảnh nào.', _tuLieu ? 'info' : 'error');
  if (!confirm(`Tạo lại prompt ảnh cho ${scenes.length} cảnh dùng ẢNH AI`
    + (_tuLieu ? ` (bỏ qua ${_tuLieu} cảnh dùng tư liệu có sẵn)` : '')
    + `?\nGIỮ nguyên chia cảnh, timing, lời đọc, danh sách nhân vật/bối cảnh. Prompt cũ sẽ bị thay.`)) return;
  const btn = document.getElementById('t2RegenAllBtn'); if (btn){ btn.disabled = true; btn.textContent = '⏳ Đang tạo lại…'; }
  if (typeof clearCancel === 'function') clearCancel();
  try {
    if (typeof genVideoLogline === 'function') { try { await genVideoLogline(false); } catch (e) {} }
    const profileContext = `Kênh: ${p.tenKenh}\nNgách: ${p.ngach}\nPOV: ${p.povStyle}\nCấu trúc: ${p.cauTruc}`;
    const B = 6; let done = 0;
    if (!state.scenePrompts) state.scenePrompts = {};
    const batches = [];
    for (let i = 0; i < scenes.length; i += B) batches.push({ list: scenes.slice(i, i + B), start: i });
    const CONC = Math.min(4, batches.length);   // ⚡ chạy SONG SONG 4 lô cho nhanh (API chịu được)
    let bi = 0, finished = 0;
    const worker = async () => {
      while (bi < batches.length && !state.cancelRequested){
        const b = batches[bi++];
        let prevSceneCtx = '';
        if (b.start > 0){ const pv = scenes[b.start - 1]; const pp = state.scenePrompts[pv.id]; if (pp) prevSceneCtx = `[${pv.id}] ${String(pp).slice(0, 220)}`; }
        try {
          const prompt = buildSceneGenPrompt(b.list, prevSceneCtx, p, profileContext, '');
          let parsed = [];
          for (let attempt = 0; attempt < 2 && !parsed.length; attempt++){
            const reply = await callLLM(prompt, { maxTokens: 2200, _override: { thinking: false } });
            parsed = safeParseJSON(reply, a => Array.isArray(a)) || [];
          }
          for (const it of parsed){
            if (!it) continue;
            const sc = b.list.find(s => String(s.id) === String(it.id)) || null;
            const raw = cleanPrompt(String(it.prompt || ''));
            if (sc && raw && !_isLazyPrompt(raw)){
              state.scenePrompts[sc.id] = _ensureSceneTags(raw, sc);
              if (state.scenePrompts2 && state.scenePrompts2[sc.id] && typeof _mirrorTagsFromA === 'function')
                state.scenePrompts2[sc.id] = _mirrorTagsFromA(state.scenePrompts2[sc.id], state.scenePrompts[sc.id]);
              done++;
            }
          }
        } catch (e){ console.warn('[regenAll]', e); }
        finished++;
        setStatus2(`🔧 Tạo lại prompt… ${finished}/${batches.length} lô (${done} cảnh xong)`, 'working');
        if (typeof renderPromptsV === 'function') renderPromptsV();
      }
    };
    await Promise.all(Array.from({ length: CONC }, () => worker()));
    if (typeof saveState === 'function') saveState();
    if (typeof renderPromptsV === 'function') renderPromptsV();
    if (typeof renderTable === 'function') renderTable();
    setStatus2(`✓ Đã tạo lại ${done}/${scenes.length} prompt (giữ nguyên cảnh). Ảnh cũ vẫn còn — tạo lại ảnh nếu muốn khớp prompt mới.`, 'ok');
  } catch (e){ console.error(e); setStatus2('Lỗi tạo lại prompt: ' + (e.message || e), 'error'); }
  finally { const b = document.getElementById('t2RegenAllBtn'); if (b){ b.disabled = false; b.textContent = '🔧 Tạo lại tất cả prompt'; } }
}

async function makeSafePrompt(id, which){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile.', 'error');
  const store = which === 'B' ? state.scenePrompts2 : state.scenePrompts;
  const original = store && store[id];
  if (!original) return setStatus2('Chưa có prompt để sửa.', 'error');

  setStatus2(`Đang làm mềm prompt [${id}${which === 'B' ? 'b' : ''}]...`, 'working');
  try {
    const prompt = `Prompt tạo ảnh dưới đây bị bộ lọc nội dung TỪ CHỐI (vì có nội dung chết chóc/bạo lực/thương vong). Hãy VIẾT LẠI để qua được bộ lọc mà GIỮ NGUYÊN ý nghĩa, bối cảnh, style, góc máy.

QUY TẮC viết lại:
- Bỏ hết từ: dead, death, dying, corpse, drowning, blood, gore, victim, suffering, kill, die
- Thay bằng cách diễn đạt gián tiếp: peaceful, drifting, floating, eyes closed, cold, somber, quiet, still, distant, fading, motionless
- Cảnh người chết/chìm → "figure drifting peacefully in dark water, eyes closed, calm"
- Cảnh thương vong số đông → "vast empty dark scene, somber mood, distant scattered lights" (KHÔNG vẽ người)
- Giữ nguyên: tên nhân vật [trong ngoặc], tên bối cảnh [trong ngoặc], style, ánh sáng, góc máy, tông màu
- Giữ độ dài tương đương

PROMPT GỐC (bị chặn):
${original}

Trả về CHỈ prompt đã viết lại (tiếng Anh), không giải thích.`;
    const safe = await callClaude(prompt, 600);
    store[id] = safe.trim();
    renderPromptsV();
    saveState(true);
    setStatus2(`✓ Đã làm mềm prompt [${id}${which === 'B' ? 'b' : ''}] — thử gen lại trong G-Labs.`, 'ok');
  } catch (e) {
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function genBatchPromptB(batch, p){
  const sceneBlocks = batch.map(s => {
    const promptA = cleanPrompt(state.scenePrompts[s.id] || '');
    const tag = _isInfographicShot(s.shot) ? ' [LOẠI: INFOGRAPHIC/BIỂU ĐỒ]' : '';
    return `[${s.id}]${tag} (${s.duration}s)\nVO: "${s.text}"\nPrompt A: "${promptA}"`;
  }).join('\n\n');

  const sysPrompt = `Bạn là prompt engineer G-Labs. Với MỖI cảnh dưới đây, tạo Prompt B — ảnh THỨ HAI của CÙNG cảnh (chiếu ngay sau Prompt A, chia đôi thời lượng).

Mỗi Prompt B phải:
- Cùng nhân vật, bối cảnh, style với Prompt A của cảnh đó
- GIỮ NGUYÊN các tag tham chiếu [tên-nhân-vật] và [tên-bối-cảnh] Y HỆT Prompt A: nếu Prompt A có [dealer-male] [perfumed-room] thì Prompt B PHẢI dùng lại đúng [dealer-male] [perfumed-room] (kèm dấu ngoặc vuông) — TUYỆT ĐỐI KHÔNG đổi thành "dealer-male", "the man", "the child"... (để G-Labs giữ nhân vật/bối cảnh nhất quán với reference sheet)
- Cảnh THƯỜNG: thể hiện khoảnh khắc/hành động TIẾP THEO (nửa sau) trong cùng cảnh.
- Cảnh [LOẠI: INFOGRAPHIC/BIỂU ĐỒ]: KHÔNG vẽ "hành động tiếp theo". Thay vào đó vẽ một GÓC KHÁC/PHẦN BỔ SUNG của cùng dữ liệu (vd Prompt A cho con số/vế đầu → Prompt B cho vế còn lại hoặc kết luận), nền trắng, CHỦ YẾU icon/hình khối, RẤT ÍT chữ (tối đa tiêu đề ngắn + vài số) — KHÔNG lặp y hệt Prompt A, KHÔNG nhồi chữ.
- Cùng độ dài & format với Prompt A (~60-100 từ)
- Tiếng Anh, bắt đầu ngay bằng mô tả visual

CÁC CẢNH:
${sceneBlocks}

Trả về JSON object, key là id cảnh, value là prompt B (tiếng Anh). VD: {"007":"...","012":"..."}
CHỈ trả JSON, không giải thích, không suy luận.`;

  // callLLMJson: ép JSON + thinking off + validate (object có ≥1 value chuỗi cho id trong batch)
  // → chống DeepSeek xả nguyên đoạn suy luận vào prompt B
  const ids = new Set(batch.map(s => String(s.id).padStart(3, '0')));
  let obj;
  try {
    obj = await callLLMJson(sysPrompt, {
      maxTokens: 2500,
      validate: o => o && typeof o === 'object' && !Array.isArray(o)
        && Object.entries(o).some(([k, v]) => ids.has(String(k).padStart(3, '0')) && typeof v === 'string' && v.trim())
    });
  } catch (e) {
    // Hết cách ở dạng batch → thử từng cảnh (cũng đã JSON-hardened)
    for (const s of batch) {
      if (state.cancelRequested) break;
      await genSingleScenePromptB(s.id);
    }
    return;
  }

  // Chuẩn hoá key về 3 chữ số rồi gán đúng cảnh
  const norm = {};
  for (const [k, v] of Object.entries(obj)) norm[String(k).padStart(3, '0')] = v;
  if (!state.scenePrompts2) state.scenePrompts2 = {};
  for (const s of batch) {
    const b = norm[s.id];
    if (b && typeof b === 'string' && b.trim()) {
      // B phải có ĐÚNG tag của A; nếu A thiếu thì backstop theo scene
      const aPrompt = state.scenePrompts[s.id] || '';
      state.scenePrompts2[s.id] = _ensureSceneTags(_mirrorTagsFromA(cleanPrompt(b.trim()), aPrompt), s);
    }
  }
}

async function genSingleScenePromptB(id){
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  const scene = state.scenes[idx];
  const promptA = cleanPrompt(state.scenePrompts[id]);
  if (!promptA) return setStatus2(`Cần tạo Prompt A cho cảnh [${id}] trước.`, 'error');
  setStatus2(`Đang tạo Prompt B cảnh [${id}]...`, 'working');
  try {
    const sysPrompt = `Bạn là prompt engineer G-Labs. Dựa trên Prompt A của cảnh, tạo Prompt B cho NỬA SAU của cảnh đó.
Prompt B phải:
- Cùng nhân vật, bối cảnh, style với Prompt A
- GIỮ NGUYÊN các tag tham chiếu [tên-nhân-vật] và [tên-bối-cảnh] Y HỆT Prompt A: nếu Prompt A có [dealer-male] [perfumed-room] thì Prompt B PHẢI dùng lại đúng [dealer-male] [perfumed-room] (kèm dấu ngoặc vuông) — TUYỆT ĐỐI KHÔNG đổi thành "dealer-male", "the man", "the child"... (để G-Labs giữ nhân vật/bối cảnh nhất quán với reference sheet)
- Thể hiện HÀNH ĐỘNG / TRẠNG THÁI tiếp theo (sau khi Prompt A kết thúc)
- Cùng độ dài và format với Prompt A (~60-100 từ)
- Tiếng Anh, bắt đầu ngay bằng mô tả visual

VO cảnh: "${scene.text}"
Thời lượng: ${scene.duration}s
Prompt A: "${promptA}"

Trả về CHỈ 1 JSON object: {"prompt":"<prompt B tiếng Anh, bắt đầu ngay bằng mô tả visual, KHÔNG prefix>"}. KHÔNG giải thích, KHÔNG suy luận, KHÔNG văn xuôi ngoài JSON.`;
    // callLLMJson: ép JSON + thinking off → chống DeepSeek xả suy luận thành prompt
    const got = await callLLMJson(sysPrompt, {
      maxTokens: 500,
      validate: o => o && typeof o.prompt === 'string' && o.prompt.trim().length > 20
    });
    const clean = cleanPrompt(String(got.prompt).trim());
    if (clean) {
      if (!state.scenePrompts2) state.scenePrompts2 = {};
      // B phải có ĐÚNG tag của A (cùng nhân vật + bối cảnh); backstop theo scene nếu A thiếu
      state.scenePrompts2[id] = _ensureSceneTags(_mirrorTagsFromA(clean, promptA), scene);
      renderPromptsV();
      setStatus2(`✓ Đã tạo Prompt B cảnh [${id}].`, 'ok');
      saveState(true);
    } else {
      setStatus2(`⚠️ Tạo Prompt B thất bại, thử lại.`, 'error');
    }
  } catch(e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

async function doGenerateScenePrompts(){
  _llmStep = 'prompt cảnh';
  syncTool2();
  if (state.scenes.length === 0) return setStatus2('Cần chia cảnh trước.', 'error');
  const bs = parseInt(document.getElementById('batchSize')?.value) || 5;
  const p = getProfile();
  if (!p) return setStatus2('Cần Profile trước.', 'error');

  /* Chỉ tạo cảnh CHƯA có prompt → bấm lại sau khi Dừng sẽ chạy tiếp, không làm lại từ đầu.
     BỎ HẲN cảnh đã giao cho nguồn tư liệu: prompt của chúng KHÔNG được dùng ở đâu cả —
     đường stock và đường web đều tìm bằng LỜI THOẠI (generateSearchAngles(sc.text)),
     không đọc scenePrompts. Video 155 cảnh mà 90 cảnh dùng tư liệu thì đó là 90 lượt
     gọi AI viết ra thứ vứt đi. Cảnh nào tìm không ra hình sẽ được cứu ở bước sau
     (_t2CuuCanhTrong) — lúc đó mới sinh prompt, và chỉ cho đúng số cảnh cần.        */
  const _boQua = state.scenes.filter(_laThuc).length;
  const todo = state.scenes.filter(s => !_laThuc(s) && (!state.scenePrompts[s.id] || !state.scenePrompts[s.id].trim()));
  const already = state.scenes.length - todo.length - _boQua;
  if (todo.length === 0) {
    return setStatus2(_boQua
      ? `Không còn cảnh nào cần prompt — ${_boQua} cảnh dùng tư liệu có sẵn (không cần prompt), còn lại đã có.`
      : `Tất cả ${state.scenes.length} cảnh đã có prompt. Muốn tạo lại từ đầu? Bấm "🗑 Xoá hết" rồi tạo lại.`, 'info');
  }
  if (_boQua && typeof novaLog === 'function')
    novaLog(`✍️ Bỏ qua ${_boQua} cảnh dùng tư liệu có sẵn — không cần prompt ảnh.`, 'ok');

  // 🎯 Đảm bảo có logline (tự sinh lại nếu kịch bản đã đổi) → mọi cảnh bám chủ đề toàn video
  setStatus2('🎯 Kiểm tra logline toàn video...', 'working');
  await genVideoLogline(false);

  setStatus2(already > 0
    ? `Chạy tiếp: đã có ${already} prompt, còn ${todo.length} cảnh...`
    : 'AI đang sinh prompt ảnh...', 'working');
  clearCancel();
  const profileContext = `Kênh: ${p.tenKenh}\nNgách: ${p.ngach}\nPOV: ${p.povStyle}\nCấu trúc: ${p.cauTruc}`;

  // Ngữ cảnh cảnh ngay trước (giữ mạch hình ảnh liền lạc, tránh rời rạc)
  let prevSceneCtx = '';
  // Nếu chạy tiếp, lấy prompt cảnh ngay trước cảnh đầu tiên trong todo làm mồi
  if (todo.length && state.scenes.length) {
    const firstIdx = state.scenes.findIndex(s => s.id === todo[0].id);
    if (firstIdx > 0) {
      const prev = state.scenes[firstIdx - 1];
      const pp = state.scenePrompts[prev.id];
      if (pp) prevSceneCtx = `[${prev.id}] ${pp.slice(0, 220)}`;
    }
  }

  // Xử lý 1 batch (độc lập). seedCtx = ngữ cảnh mồi (chỉ dùng khi chạy tuần tự).
  const processSceneBatch = async (batch, seedCtx) => {
    let neighborVO = '';
    const fi = state.scenes.findIndex(s => s.id === batch[0].id);
    const li = state.scenes.findIndex(s => s.id === batch[batch.length - 1].id);
    const bPrev = fi > 0 ? state.scenes[fi - 1] : null;
    const bNext = li >= 0 && li < state.scenes.length - 1 ? state.scenes[li + 1] : null;
    if (bPrev) neighborVO += `Cảnh trước batch [${bPrev.id}]: "${(bPrev.text || '').slice(0, 180)}"\n`;
    if (bNext) neighborVO += `Cảnh sau batch [${bNext.id}]: "${(bNext.text || '').slice(0, 180)}"`;
    const prompt = buildSceneGenPrompt(batch, seedCtx, p, profileContext, neighborVO);
    // Thinking OFF + validate (mảng có ít nhất 1 {prompt}) — chống DeepSeek nhét suy luận vào output
    const vArr = a => Array.isArray(a) && a.some(x => x && x.prompt);
    let parsed = [];
    for (let attempt = 0; attempt < 2 && !parsed.length; attempt++) {
      try {
        const reply = await callLLM(prompt, { maxTokens: 4000, _override: { thinking: false } });
        parsed = safeParseJSON(reply, vArr);
      } catch (e) { if (attempt) throw e; }
    }
    // Vẫn hỏng mà lô còn nhiều cảnh → CHIA ĐÔI gọi lại (đệ quy tới từng cảnh) — mất 1 cảnh còn hơn mất cả lô.
    if (!parsed.length && batch.length > 1 && !state.cancelRequested) {
      const mid = Math.ceil(batch.length / 2);
      if (typeof novaLog === 'function') novaLog(`  ↻ Lô prompt ${batch[0].id}-${batch[batch.length - 1].id} hỏng — chia đôi thử lại…`, 'warn');
      await processSceneBatch(batch.slice(0, mid), seedCtx);
      if (!state.cancelRequested) await processSceneBatch(batch.slice(mid), seedCtx);
      return;
    }
    // CHỈ gán cho cảnh thuộc batch này → không đè nhầm cảnh khác
    const batchIds = batch.map(s => s.id);
    const batchIdSet = new Set(batchIds);
    parsed.forEach((x, idx) => {
      let id = String(x.id || '').padStart(3, '0');
      if (!batchIdSet.has(id)) id = batchIds[idx];   // AI trả ID sai → khớp theo vị trí
      if (id && batchIdSet.has(id) && x.prompt) {
        const sc = state.scenes.find(s => s.id === id);
        const raw = _forceStyleTail(cleanPrompt(x.prompt), p);   // đuôi style do APP gắn → 155 cảnh giống hệt
        if (_isLazyPrompt(raw)) return;   // prompt lười/placeholder → BỎ, để trống cho "Tạo nốt cảnh thiếu"
        state.scenePrompts[id] = _ensureSceneTags(raw, sc);
      }
    });
    renderPromptsV();
    const done = state.scenes.filter(s => state.scenePrompts[s.id] && state.scenePrompts[s.id].trim()).length;
    setStatus2(`Tạo prompt... ${done}/${state.scenes.length}${lanes > 1 ? ` (⚡ ${lanes} luồng)` : ''}`, 'working');
  };

  const lanes = Math.min(3, _concurrency());   // trần 3 luồng — nhiều hơn chỉ ăn 429 chứ không nhanh hơn
  const batches = [];
  for (let i = 0; i < todo.length; i += bs) batches.push(todo.slice(i, i + bs));

  try {
    if (lanes > 1) {
      // SONG SONG (nhiều key): chạy batch ĐẦU trước làm "mỏ neo" phong cách mở đầu,
      // rồi chạy các batch còn lại song song — mỗi batch tự lấy prompt cảnh NGAY TRƯỚC làm mồi NẾU đã có
      // → đỡ đứt tông ở mối nối batch. Mối nối sâu vẫn dựa vào 🎯 logline + VO lân cận.
      const seedFor = (b) => {
        const fi = state.scenes.findIndex(s => s.id === b[0].id);
        if (fi > 0) { const pv = state.scenes[fi - 1]; const pp = state.scenePrompts[pv.id]; if (pp && pp.trim()) return `[${pv.id}] ${pp.slice(0, 220)}`; }
        return '';
      };
      if (batches.length) await processSceneBatch(batches[0], prevSceneCtx);
      const rest = batches.slice(1);
      if (!state.cancelRequested && rest.length)
        await runConcurrent(rest, b => processSceneBatch(b, seedFor(b)), lanes, () => state.cancelRequested);
    } else {
      // TUẦN TỰ (1 key): giữ liên kết mạch hình ảnh giữa các batch
      for (const batch of batches) {
        if (state.cancelRequested) break;
        await processSceneBatch(batch, prevSceneCtx);
        for (let k = batch.length - 1; k >= 0; k--) {
          const pp = state.scenePrompts[batch[k].id];
          if (pp && pp.trim()) { prevSceneCtx = `[${batch[k].id}] ${pp.slice(0, 220)}`; break; }
        }
      }
    }
    if (state.cancelRequested) {
      clearCancel();
      const done = state.scenes.filter(s => state.scenePrompts[s.id] && state.scenePrompts[s.id].trim()).length;
      setStatus2(`⏸ Đã dừng. Đã tạo ${done}/${state.scenes.length}. Bấm "Tạo Prompt ảnh" để chạy TIẾP từ chỗ dừng.`, 'info');
      saveState();
      return;
    }
    const finalMissing = state.scenes.filter(s => !state.scenePrompts[s.id] || !state.scenePrompts[s.id].trim()).length;
    setStatus2(finalMissing > 0
      ? `⚠️ Xong nhưng còn ${finalMissing} cảnh AI tạo lỗi. Bấm "🔧 Tạo nốt cảnh thiếu" lại, hoặc giảm Batch xuống 2-3 cho chắc.`
      : `✓ Đã sinh đủ ${state.scenes.length} prompt ảnh.`, finalMissing > 0 ? 'info' : 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus2('Lỗi: ' + e.message, 'error');
  }
}

// === L?: let _autoRunning ===
let _autoRunning = false;

// === L?: let _autoStopFlag ===
let _autoStopFlag = false;

// === L?: let _autoAudioFile ===
let _autoAudioFile = null;

// === L?: let _autoAudioWords ===
let _autoAudioWords = null;

// === L?: const AUTO_STEPS ===
const AUTO_STEPS = [
  { label: 'Lọc' },
  { label: 'Chia cảnh' },
  { label: 'Căn timing' },
  { label: 'Cân đều cảnh' },
  { label: 'Căn lại' },
  { label: 'Quét trước' },
  { label: 'Gán tài nguyên' },
  { label: 'Prompt ảnh' },
  { label: 'Ảnh B (cảnh dài)' }
];

// === L?: const FLOW_STEPS ===
const FLOW_STEPS = [
  { label: '🎭 Prompt asset' },
  { label: '🖼 Ảnh asset' },
  { label: '🖼 Ảnh cảnh' }
];

// === L?: const FS_ASSET_PROMPT ===
const FS_ASSET_PROMPT = AUTO_STEPS.length;

// === L?: const FS_ASSET_IMG ===
const FS_ASSET_IMG    = AUTO_STEPS.length + 1;

// === L?: const FS_SCENE_IMG ===
const FS_SCENE_IMG    = AUTO_STEPS.length + 2;

// === L?: const SCENE_TYPE_VI ===
const SCENE_TYPE_VI = { hook: 'Mở màn', establishing: 'Cảnh rộng', scene: 'Kể chuyện', 'close-up': 'Cận cảnh', 'b-roll': 'Minh hoạ', compare: 'So sánh', flashback: 'Hồi tưởng', dream: 'Tưởng tượng', map: 'Bản đồ', reveal: 'Lật mở', transition: 'Chuyển chương' };

// === L?: const _CROWD_RE ===
const _CROWD_RE = /^(crowd|crowds|people|persons?|bystanders?|passers?[- ]?by|onlookers?|audience|extras?|villagers?|workers?|colleagues?|co[- ]?workers?|staff|patients|doctors|nurses|guests|attendees|group|team|everyone|others?|strangers?|figures?|silhouettes?|men|women|children|kids|customers?|shoppers?|pedestrians?|soldiers?|students?|guards?|reporters?|crowd of .*)$/i;

// === L?: const _T2_BG_MIN ===
const _T2_BG_MIN = 2;

// === L?: let _t2KhopCuoi ===
let _t2KhopCuoi = null;

// === L?: let _t2RegenPending ===
let _t2RegenPending = new Set();

// === L?: let _t2RegenRunning ===
let _t2RegenRunning = false;

// === L?: let _t2RegenDone, _t2RegenErr, _t2RegenTotal ===
let _t2RegenDone = 0, _t2RegenErr = 0, _t2RegenTotal = 0;

// === L?: let _t2RegenSeen ===
let _t2RegenSeen = new Map();

// === L?: let _t2RegenPanelOpen ===
let _t2RegenPanelOpen = true;

// === L?: let _t2RegenCtx, _t2RegenConc, _t2RegenWorkers, _t2RegenSetup, _t2RegenOwn ===
let _t2RegenCtx = null, _t2RegenConc = 1, _t2RegenWorkers = 0, _t2RegenSetup = false, _t2RegenOwn = false;

// === L?: function renderTable ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=6974c, shared=6769c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function renderTable(){
  const tbl = document.getElementById('sceneTable');
  const body = document.getElementById('sceneBody');
  const empty = document.getElementById('emptyList');
  const addRow = document.getElementById('addSceneRow');
  if (!tbl) return;
  document.getElementById('badge-list').textContent = state.scenes.length;
  const listBar = document.getElementById('sceneListBar');
  if (state.scenes.length === 0) {
    tbl.style.display = 'none';
    empty.style.display = 'block';
    if (addRow) addRow.style.display = 'block';
    if (listBar) listBar.style.display = 'none';
    return;
  }
  tbl.style.display = 'table'; empty.style.display = 'none';
  if (listBar) listBar.style.display = 'flex';
  if (addRow) addRow.style.display = 'block';

  let _acc = 0;
  const _starts = state.scenes.map(s => { const st = _acc; _acc += (parseFloat(s.duration) || 0); return st; });
  const _fmt = t => Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0');

  body.innerHTML = state.scenes.map((s, i) => {
    const isEditing = state.editingSceneIdx === i;
    if (isEditing) {
      return `<tr class="editing-row">
        <td class="id">${s.id}</td>
        <td colspan="5" style="padding:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 80px;gap:6px;margin-bottom:6px">
            <input type="text" id="edt_char_${i}" placeholder="Nhân vật" value="${escapeHtml(s.character || '')}" style="padding:5px 8px;font-size:12px">
            <input type="text" id="edt_bg_${i}" placeholder="Bối cảnh" value="${escapeHtml(s.background || '')}" style="padding:5px 8px;font-size:12px">
            <input type="text" id="edt_cam_${i}" placeholder="Camera" value="${escapeHtml(s.camera || 'medium')}" style="padding:5px 8px;font-size:12px">
            <input type="number" id="edt_dur_${i}" placeholder="Sec" value="${s.duration || 3}" min="1" max="60" style="padding:5px 8px;font-size:12px">
          </div>
          <textarea id="edt_text_${i}" placeholder="Lời đọc VO" style="min-height:50px;font-size:12px;padding:6px 8px">${escapeHtml(s.text || '')}</textarea>
          <div style="margin-top:6px;display:flex;gap:8px">
            <button class="btn primary sm" onclick="saveEditScene(${i})">✓ Lưu</button>
            <button class="btn ghost sm" onclick="cancelEditScene()">Huỷ</button>
          </div>
        </td>
      </tr>`;
    }
    const isLast = i === state.scenes.length - 1;
    const imgCell = _t2SceneImgCell(s);
    const start = _starts[i], end = start + (parseFloat(s.duration) || 0);
    const pr = state.scenePrompts?.[s.id] || '';
    const prHtml = pr ? escapeHtml(pr).replace(/\[([^\]]+)\]/g, '<b style="color:var(--accent)">[$1]</b>') : '';
    return `<tr data-sid="${s.id}">
      <td class="id">${s.id}</td>
      <td style="font-family:ui-monospace,monospace;font-size:11px;color:var(--text-muted);white-space:nowrap;line-height:1.35">${_fmt(start)}<br>${_fmt(end)}</td>
      <td class="dur" style="white-space:nowrap">${s.duration || 0}s${(state.scenePrompts2 && state.scenePrompts2[s.id] && String(state.scenePrompts2[s.id]).trim()) ? `<br><span style="font-size:9px;color:var(--accent);font-weight:700">2 ảnh · ${(((parseFloat(s.duration) || 0) / 2)).toFixed(1)}s/ảnh</span>` : ''}</td>
      <td>${_shotBadge(s.shot)}${(function(){ const w = _t2SceneWarns(s, i, state.scenes || []); return w.length ? ` <span title="${escapeHtml(w.join(' · '))}" style="font-size:11px;cursor:help;color:var(--amber)">⚠</span>` : ''; })()}${s.wantVideo ? ' <span title="Cảnh này sẽ làm VIDEO Veo (motion) khi Tạo Video" style="font-size:11px">🎬</span>' : ''}${s.wantStock ? ` <span onclick="t2OpenStockPicker('${s.id}')" title="Cảnh dùng VIDEO STOCK free — bấm để chọn trong ${((state.stockCandidates||{})[s.id]||[]).length || 'các'} ứng viên" style="font-size:11px;cursor:pointer;padding:1px 3px;border-radius:4px;${((state.stockCandidates||{})[s.id]||[]).length ? 'background:var(--accent-soft)' : ''}">🎞${((state.stockCandidates||{})[s.id]||[]).length ? '▾' : ''}</span>` : ''}${s.wantYt ? ' <span title="Cảnh này lấy CLIP YOUTUBE — luồng tự động tự lấy ở bước Xen video, hoặc vào Dựng Video chọn cảnh rồi bấm 🎬 YouTube" style="font-size:11px">▶️</span>' : ''}${s.wantWeb ? ` <span onclick="t2OpenWebPicker('${s.id}')" title="Cảnh dùng TƯ LIỆU NGUỒN WEB — bấm để xem/đổi trong ${((state.webCandidates||{})[s.id]||[]).length || 'các'} ứng viên" style="font-size:11px;cursor:pointer;padding:1px 3px;border-radius:4px;${((state.webCandidates||{})[s.id]||[]).length ? 'background:var(--accent-soft)' : ''}">🌐${((state.webCandidates||{})[s.id]||[]).length ? '▾' : ''}</span>` : ''}</td>
      <td style="text-align:center;padding:8px 4px">${imgCell}</td>
      <td style="position:relative">
        <div class="sb-rowacts">
          <button onclick="editScene(${i})" title="Sửa lời đọc/nhân vật/thời lượng">✏️</button>
          <button onclick="t2QueueRegen('${s.id}')" title="Tạo lại ẢNH cảnh này — tự xếp vào hàng đợi (bấm nhiều cảnh sẽ nối hàng, chạy theo luồng đa tài khoản)" ${pr ? '' : 'disabled'}>🎨</button>
          <button onclick="addSceneAfter(${i})" title="Thêm cảnh sau">⊕</button>
          <button onclick="mergeSceneWithNext(${i})" title="Gộp với cảnh sau" ${isLast ? 'disabled' : ''}>⊗</button>
          <button onclick="delScene(${i})" title="Xoá cảnh">✕</button>
        </div>
        <div style="font-size:13px;line-height:1.5;color:var(--text);padding-right:30px">"${escapeHtml(s.text)}"</div>
        ${prHtml ? `<div style="font-family:ui-monospace,monospace;font-size:9.5px;line-height:1.4;color:var(--text-dim);background:var(--surface-2);border:1px dashed var(--border-2);border-radius:6px;padding:5px 8px;margin-top:6px">${prHtml}</div>` : ''}
      </td>
    </tr>`;
  }).join('');
  // Setup drag-drop on each empty image cell
  document.querySelectorAll('#sceneBody .sb-drop').forEach(el => {
    el.addEventListener('dragover', e => { e.preventDefault(); el.style.background = 'var(--accent-soft)'; });
    el.addEventListener('dragleave', () => { el.style.background = ''; });
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.style.background = '';
      const tr = el.closest('tr');
      const sid = tr?.dataset.sid;
      if (sid && e.dataTransfer.files[0]) t2HandleSceneImage(sid, e.dataTransfer.files[0]);
    });
  });
  if (typeof _t2RegenBar === 'function') _t2RegenBar();   // đồng bộ chỉ báo hàng đợi tạo lại sau khi render
  if (typeof _t2RegenPending !== 'undefined') _t2RegenPending.forEach(k => _t2MarkQueued(String(k).replace(/::b$/, '')));   // giữ badge ⏳ cho cảnh đang chờ (bỏ hậu tố ::b của ảnh B)
  _t2UpdateGenSceneMiss();
}

// === L?: function saveEditScene ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1430c, shared=732c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function saveEditScene(idx){
  const s = state.scenes[idx];
  if (!s) return;
  s.text = document.getElementById('edt_text_' + idx).value.trim();
  s.character = document.getElementById('edt_char_' + idx).value.trim();
  s.background = document.getElementById('edt_bg_' + idx).value.trim();
  s.camera = document.getElementById('edt_cam_' + idx).value.trim() || 'medium';
  s.duration = parseInt(document.getElementById('edt_dur_' + idx).value) || 3;
  state.editingSceneIdx = -1;
  renderTable(); renderPreview(); renderPromptsV();
  if (typeof renderVeoPrompts === 'function') renderVeoPrompts();
  if (typeof updateStats === 'function') updateStats(); saveState(true);
  setStatus2(`✓ Đã sửa cảnh ${s.id}.`, 'ok');
}

// === L?: const setStatus3 ===
const setStatus3 = (m, t) => setStatusBar('status3', m, t);

async function autoFillEra(force){
  const el = document.getElementById('t3Era');
  if (!el) return;
  if (!force && el.value.trim()) return;            // đã có giá trị → không đè (trừ khi bấm nút)
  const script = (state.script || '').trim();
  if (!script) { if (force) setStatus3('Tool 02 chưa có kịch bản để suy bối cảnh.', 'info'); return; }
  const prevPh = el.placeholder;
  el.placeholder = '⏳ Đang suy bối cảnh & thời đại từ kịch bản...';
  try {
    const prompt = `Đọc đoạn kịch bản dưới đây. Trả về CHỈ 1 JSON object mô tả BỐI CẢNH + THỜI ĐẠI + VĂN HOÁ (tiếng Anh, 1 dòng) để chọn TRANG PHỤC + KIỂU TÓC/ĐỘI ĐẦU đúng thời: nơi chốn, thời kỳ (kèm năm nếu suy được), vài món trang phục đặc trưng, kiểu tóc/đội đầu đặc trưng.
Định dạng: {"era":"<mô tả 1 dòng>"}
VD: {"era":"Ancient Egypt, New Kingdom (~1300 BCE) — clothing: linen kilts, wesekh collars, sandals; hair: shaved heads or black bob wigs, nemes headcloth; no modern clothing or hairstyles"}
CHỈ in JSON, KHÔNG giải thích.

KỊCH BẢN:
"""
${script.slice(0, 2500)}
"""`;
    let reply = '';
    // callLLMJson: lặp + ép JSON + chỉ nhận khối có era là chuỗi không rỗng
    try {
      const o = await callLLMJson(prompt, { maxTokens: 300, validate: o => o && typeof o.era === 'string' && o.era.trim() });
      reply = String(o.era).trim();
    } catch (_) {}
    if (!reply) {  // fallback: model trả văn xuôi → quét dòng đúng format (có "clothing:"/"—"/"hair:")
      const raw = (await callClaude(prompt, 300)) || '';
      const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
      reply = (lines.find(l => /clothing:|hair:|—/i.test(l)) || lines[lines.length - 1] || '').replace(/^["'\s]+|["'\s]+$/g, '');
    }
    if (!reply) throw new Error('AI trả về rỗng');
    el.value = reply;
    state.t3Era = reply;
    setStatus3('✓ Đã tự điền Bối cảnh & thời đại từ kịch bản — kiểm tra/sửa nếu cần rồi Generate.', 'ok');
    saveState();
  } catch (e) {
    console.warn('autoFillEra:', e);
    if (force) setStatus3('Không suy được bối cảnh: ' + e.message, 'error');
  } finally {
    el.placeholder = prevPh;
  }
}

// === L?: let _autoT3Running ===
let _autoT3Running = false;

// === L?: const ASSET_NO_TEXT_RULE ===
const ASSET_NO_TEXT_RULE = 'NO-TEXT RULE (bắt buộc, ưu tiên cao nhất): ảnh cuối cùng KHÔNG được chứa bất kỳ chữ nào — không tiêu đề, không header, không số thứ tự panel, không nhãn, không tên cảm xúc, không caption, không watermark, không chữ ký. TUYỆT ĐỐI không ghi nhãn cho các góc nhìn hay biểu cảm. Prompt bạn viết ra PHẢI kết thúc bằng đúng câu: "no text, no title, no labels, no captions, no numbers, no watermark anywhere in the image, pure artwork only".';

// === L?: const ASSET_CHAR_LAYOUT ===
const ASSET_CHAR_LAYOUT = 'LAYOUT: one clean character reference sheet on a plain off-white background. The SAME character shown full-body from five angles in a single horizontal row: front, three-quarter front, side profile, three-quarter back, full back. Full-body turnaround ONLY — NO expression chart, NO row or grid of face close-ups, NO thumbnail strip, NO extra panels or tiles below or beside the figures. Identical character design, proportions and outfit in every pose. LIGHTING: even, soft, neutral reference lighting that reveals every design detail clearly — no heavy dramatic shadows that hide the face, hands or costume. CRISPNESS: razor-sharp clean linework with precise edges, high resolution, deep sharp focus across the whole sheet, richly detailed, never soft, blurry, hazy or washed out. ' + ASSET_NO_TEXT_RULE;

// === L?: const ASSET_CHAR_LAYOUT_PHOTO ===
const ASSET_CHAR_LAYOUT_PHOTO = 'LAYOUT: one character reference board made of REAL PHOTOGRAPHS of the SAME real person on a plain neutral-grey photo-studio background: full-body photos from five angles in a single row (front, three-quarter front, side profile, three-quarter back, full back) with identical outfit, hair and lighting. Full-body turnaround ONLY — NO expression chart, NO row or grid of face close-ups, NO thumbnail strip, NO extra panels or tiles. Photorealistic studio photography throughout, the SAME face, hair and wardrobe consistent in every photo. This is a PHOTO casting board — NOT a drawing, NOT an illustration, NOT an anime/manga model sheet, NOT a cartoon, NOT concept art, no color-palette swatches. LIGHTING: even, soft, neutral studio lighting that shows the face, hair and wardrobe clearly — no heavy dramatic shadows. Sharp focus, high resolution, crisp fine detail throughout, never soft or blurry. ' + ASSET_NO_TEXT_RULE;

// === L?: const ASSET_BG_LAYOUT ===
const ASSET_BG_LAYOUT = 'LAYOUT: one background/location reference sheet as a clean 2x2 grid of four views of the SAME place — wide establishing view, medium view from the opposite side, high isometric overview, and a low close-up detail with dramatic lighting. Consistent architecture, props and color palette across all four cells. No people, no characters. CRISPNESS: render every cell razor-sharp and highly detailed — crisp clean bold linework with precise edges, rich environmental detail (individual bricks, props, textures, ornament), high resolution, deep sharp focus throughout; keep the lighting moody and atmospheric but the artwork itself must be sharp and punchy, never soft, blurry, hazy or washed out. ' + ASSET_NO_TEXT_RULE;

// === L?: const ASSET_BG_LAYOUT_SINGLE ===
const ASSET_BG_LAYOUT_SINGLE = 'LAYOUT: ONE single full-frame cinematic image of this one location — NOT a grid, NOT multiple panels, NOT split into cells, just ONE clean wide establishing shot that clearly shows the architecture, key props and lighting of the place, with strong perspective and layered depth, 16:9. CRISPNESS: razor-sharp clean bold linework with precise edges, rich environmental detail (individual bricks, props, textures, ornament), high resolution, deep sharp focus across the whole frame, punchy — keep the lighting moody and atmospheric but NEVER soft, blurry, hazy or washed out. No people, no characters. ' + ASSET_NO_TEXT_RULE;

// === L?: function _t3StyleCtx ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=2330c, shared=2262c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _t3StyleCtx(){
  const p = getProfile();
  const charStyle  = document.getElementById('t3CharStyle').value  || p?.characterStyle  || '';
  const charStyleB = document.getElementById('t3CharStyleB')?.value || p?.characterStyleB || '';
  const bgStyle    = document.getElementById('t3BgStyle').value    || p?.backgroundStyle  || '';
  const rules = document.getElementById('t3PromptRules').value || p?.promptRules || '';
  // 🏺 Ngữ cảnh THỜI ĐẠI cho trang phục: ưu tiên ô "Bối cảnh & thời đại", nếu trống → trích kịch bản Tool 02
  const eraInput = (document.getElementById('t3Era')?.value || state.t3Era || '').trim();
  const scriptHint = (state.script || '').replace(/\s+/g, ' ').trim().slice(0, 700);
  const eraCtx = eraInput
    ? `\nBỐI CẢNH & THỜI ĐẠI (suy TRANG PHỤC đúng thời từ đây): ${eraInput}`
    : (scriptHint ? `\nTRÍCH KỊCH BẢN (suy thời đại + trang phục từ đây): "${scriptHint}"` : '');
  const eraRule = (eraInput || scriptHint)
    ? `\n- TRANG PHỤC + KIỂU TÓC/ĐỘI ĐẦU + phụ kiện phải ĐÚNG thời đại/bối cảnh ở trên (vd Ai Cập cổ → khố/váy lanh, áo choàng lanh, vòng cổ wesekh, dép cói; KHÔNG vest/sơ mi/cà vạt/tạp dề hiện đại nếu sai thời). GIỮ NGUYÊN art-style/phong cách render của kênh ĐÚNG theo Character Style ở trên (vd kênh ảnh thật → giữ ảnh thật, kênh 2D → giữ 2D) — CHỈ đổi quần áo, tóc, kiểu đầu, đội đầu, trang sức cho khớp thời đại, KHÔNG đổi phong cách vẽ/chất liệu.`
    : '';
  // 🏺 Luật thời đại cho BỐI CẢNH (kiến trúc/vật liệu/đồ vật/ánh sáng theo đúng thời)
  const eraRuleBg = (eraInput || scriptHint)
    ? `\n- Kiến trúc, vật liệu, đồ vật và nguồn sáng của bối cảnh phải ĐÚNG thời đại/nơi chốn ở trên — KHÔNG để lẫn yếu tố hiện đại sai thời (vd Ai Cập cổ → tường gạch bùn/đá, cột khắc chữ tượng hình, đèn dầu/đuốc; KHÔNG bóng đèn điện, kính, kim loại/nhựa hiện đại).`
    : '';
  // 🖼 Kiểu ảnh bối cảnh: 'single' = 1 ảnh/mỗi bối cảnh (nét, ít lỗi) | 'grid' = 4 góc trong 1 ảnh
  const bgLayoutMode = (document.getElementById('t3BgLayout')?.value || state.t3BgLayout || 'single');
  const bgLayout = (bgLayoutMode === 'grid') ? ASSET_BG_LAYOUT : ASSET_BG_LAYOUT_SINGLE;
  return { p, charStyle, charStyleB, bgStyle, rules, eraInput, scriptHint, eraCtx, eraRule, eraRuleBg, bgLayout };
}

// === L?: const _CHAR_RISKY ===
const _CHAR_RISKY = /\b(topless|bare[-\s]?chest(ed)?|shirtless|hip[-\s]?wrap|loin[-\s]?cloth|no body hair|chest dots|naked|nude|underwear|undressed)\b/i;

async function genOneCharPrompt(rawName, ctx, opts = {}){
  const tagMatch = rawName.match(/^(.*?)\s*\[\s*(\w+)\s*\]\s*$/);
  const name    = tagMatch ? tagMatch[1].trim() : rawName.trim();
  const charTag = tagMatch ? tagMatch[2].toLowerCase() : '';
  // Bất kỳ tag nào → dùng Style B (nếu có); không tag → Style chính
  const useStyle = (charTag && ctx.charStyleB) ? ctx.charStyleB : ctx.charStyle;
  // Kênh ẢNH THẬT → dùng layout dạng ảnh chụp (tránh AI vẽ thành anime model-sheet)
  // Dùng CHUNG bộ dò medium với prompt cảnh — không thì ref nhân vật và ảnh cảnh lệch nhau (một bên vẽ, một bên ảnh).
  const _isPhotoreal = _profileMedium({ sceneStyle: (ctx.p?.sceneStyle || ''), characterStyle: useStyle, visualStyle: (ctx.p?.visualStyle || '') }).isPhoto;
  const charLayout = _isPhotoreal ? ASSET_CHAR_LAYOUT_PHOTO : ASSET_CHAR_LAYOUT;
  if (!state.assetCharPrompts) state.assetCharPrompts = {};

  // 📚 LIBRARY CHECK — nếu nhân vật đã có trong Library thì pull, skip AI gen (trừ khi forceAI HOẶC tên vai chung chung).
  if (!opts.forceAI && !_isGenericCharName(name)){
    const libEntry = checkLibraryFor('char', name);
    if (libEntry) {
      state.assetCharPrompts[name] = libEntry.prompt;
      if (libEntry.hasImage) {
        const uid = window.currentUser?.uid;
        if (uid) {
          try {
            const img = await IDB.get(uid + '/libraryImages/' + name);
            if (img) {
              if (!state.characterImages) state.characterImages = {};
              state.characterImages[name] = img;
            }
          } catch(e) {}
        }
      }
      return { name, pulled: true };
    }
  }

  const img = state.characterImages?.[name];
  const anchor = (state.styleRefImages && state.styleRefImages[0]) || null;

  // AI CHỈ tả NGOẠI HÌNH riêng của nhân vật (trang phục/tóc/đặc điểm theo thời đại).
  // Còn STYLE đầy đủ + LAYOUT (turnaround 5 góc, không hàng biểu cảm) + luật NO-TEXT → app tự RÁP CỐ ĐỊNH → mọi nhân vật đồng nhất, không bị AI bỏ sót.
  /* Trích đúng những câu KỊCH BẢN có nhắc tới nhân vật này.
     Trước đây mô tả ngoại hình chỉ suy từ TÊN + THỜI ĐẠI + NGÁCH. Với sáu
     video cùng "Mỹ hiện đại" thì AI nhận gần như cùng một đầu vào và cho ra
     gần như cùng một người — chỉ khác cái tên, mà tên thì không quyết định
     được ngoại hình. Đưa thêm câu kịch bản vào để AI biết người này LÀM GÌ:
     CEO hãng bay, nhà phân tích, thợ rửa xe — nghề nghiệp mới là thứ quyết
     định trang phục.                                                         */
  const _nhanVatTrongKichBan = (slug) => {
    const kb = String(state.script || '').replace(/\s+/g, ' ').trim();
    if (!kb) return '';
    // slug "ed-bastian" → tìm "ed bastian", và cả họ đứng riêng ("bastian").
    const tu = String(slug).split(/[-_]+/).filter(x => x.length > 2);
    if (!tu.length) return '';
    const mau = [tu.join('[\\s-]+')].concat(tu.length > 1 ? [tu[tu.length - 1]] : []);
    const cau = kb.split(/(?<=[.!?])\s+/);
    const ra = [];
    for (const m of mau) {
      let re; try { re = new RegExp('\\b' + m + '\\b', 'i'); } catch (_) { continue; }
      for (const c of cau) {
        if (re.test(c) && !ra.includes(c) && c.length > 25) ra.push(c);
        if (ra.length >= 3) break;
      }
      if (ra.length) break;                       // khớp cả tên rồi thì khỏi tìm theo họ
    }
    return ra.join(' ').slice(0, 600);
  };
  /* Hai nhân vật khác nghề vẫn hay ra cùng "blazer navy" vì mỗi người được
     sinh ĐỘC LẬP. Bản đầu tôi cho đọc trang phục của người đã sinh rồi bắt
     chọn khác — nhưng hàm này chạy SONG SONG (runConcurrent theo số key), nên
     mọi nhân vật khởi động cùng lúc và danh sách đó rỗng. Luật thành vô dụng
     ngay khi người dùng nâng số luồng.

     Nay gán MÀU theo CHỈ SỐ nhân vật trong danh sách — xác định trước, không
     phụ thuộc ai chạy xong trước. Song song bao nhiêu luồng cũng đúng.      */
  const _MAU_AO = [
    'navy blue', 'warm rust / terracotta', 'charcoal grey', 'olive green',
    'burgundy', 'cream / off-white', 'slate teal', 'mustard ochre',
    'deep plum', 'sand beige',
  ];
  const _mauCua = (() => {
    const ds = (state.charactersV || []).map(c => (typeof c === 'string' ? c : (c && (c.name || c.slug)) || ''));
    let k = ds.indexOf(name);
    if (k < 0) k = Math.abs([...String(name)].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)) % _MAU_AO.length;
    return _MAU_AO[k % _MAU_AO.length];
  })();
  const _khacCtx = `\nMÀU ÁO NGOÀI BẮT BUỘC của nhân vật này: ${_mauCua}. Mỗi nhân vật trong video được gán một màu KHÁC NHAU — kênh này vẽ mặt tối giản nên MÀU TRANG PHỤC là thứ DUY NHẤT phân biệt được người này với người kia. Chọn kiểu áo hợp nghề nghiệp, nhưng màu phải đúng màu trên.`;

  const _ctxKB = _nhanVatTrongKichBan(name);
  const _kbCtx = _ctxKB
    ? `\nNHÂN VẬT NÀY TRONG KỊCH BẢN (suy NGHỀ NGHIỆP + vai trò từ đây, rồi mới chọn trang phục cho hợp): "${_ctxKB}"`
    : '';

  const descReq = (extra) => `Mô tả NGOẠI HÌNH RIÊNG của nhân vật [${name}] cho kênh "${ctx.p?.tenKenh || ''} — ${ctx.p?.ngach || ''}".${ctx.eraCtx}${_kbCtx}${_khacCtx}
${extra}
Trả về 1-3 câu tiếng Anh NGẮN (40-80 từ), BẮT ĐẦU bằng "The character [${name}] wears", mô tả: TRANG PHỤC đúng thời đại, KIỂU TÓC/ĐỘI ĐẦU, tuổi/giới, đặc điểm nhận dạng riêng.
KHÔNG tả lại art-style chung của kênh, KHÔNG mô tả layout/bố cục, KHÔNG luật no-text. Trả về CHỈ câu mô tả.`;

  let desc;
  const _sceneDesc = (!opts.forceRewrite) ? _charDescFromScenes(name) : '';   // opts.forceRewrite → bỏ qua, cho AI viết mới
  if (_sceneDesc) {
    // ✅ Dùng ĐÚNG mô tả trang phục trong prompt cảnh → ảnh tham chiếu khớp ảnh cảnh (hết lệch quần áo).
    desc = `The character [${name}] is ${_sceneDesc}`;
  } else if (img) {
    desc = await callClaudeWithImage(descReq('Dựa CHÍNH XÁC vào ảnh reference đính kèm (trang phục, màu sắc, kiểu tóc, đặc điểm khuôn mặt).'), img.base64, img.mediaType, 400);
  } else if (anchor) {
    desc = await callClaudeWithImage(descReq('Suy trang phục/tóc/đặc điểm từ TÊN nhân vật + thời đại + ngách kênh (ảnh đính kèm chỉ để tham khảo tinh thần style).'), anchor.base64, anchor.mediaType, 400);
  } else {
    desc = await callClaude(descReq('Suy trang phục/tóc/đặc điểm từ TÊN nhân vật + thời đại + ngách kênh.'), 400);
  }
  desc = cleanPrompt(String(desc || '').trim());
  if (desc && !desc.includes('[' + name + ']')) desc = `The character [${name}]. ` + desc;   // đảm bảo có tag
  // 🧩 RÁP CỐ ĐỊNH: [style đầy đủ] + [mô tả nhân vật] + [LAYOUT kèm no-text] → luôn đủ định dạng
  // 🛡 Lọc cụm cởi trần (chống nhân vật trẻ em bị bộ lọc child-safety chặn "vi phạm chính sách")
  state.assetCharPrompts[name] = _sanitizeCharPrompt(`${useStyle} ${desc} ${charLayout}`);
  return { name, pulled: false };
}

async function genOneBgPrompt(name, ctx, opts = {}){
  if (!state.assetBgPrompts) state.assetBgPrompts = {};
  if (!opts.forceAI){
    const libEntry = checkLibraryFor('bg', name);
    if (libEntry) { state.assetBgPrompts[name] = libEntry.prompt; return { name, pulled: true }; }
  }
  const promptText = `Tạo 1 prompt ảnh chi tiết cho background reference location [${name}].

Style template:
"""
${ctx.bgStyle}
"""

ĐỊNH HƯỚNG LOOK (diễn đạt DƯƠNG TÍNH trong prompt — KHÔNG chép nguyên thành danh sách "no/not"): ${ctx.rules}
Kênh: ${ctx.p?.tenKenh || ''} — ${ctx.p?.ngach || ''}${ctx.eraCtx}

Yêu cầu:
- Mô tả chi tiết môi trường, đồ vật, ánh sáng, PHỐI CẢNH & CHIỀU SÂU (tiền cảnh–trung cảnh–hậu cảnh) để bối cảnh có không gian
- Ghi tên bối cảnh [${name}] trong prompt
- DƯƠNG TÍNH: tả thứ MUỐN thấy, HẠN CHẾ tối đa "no X / not Y" (Nano Banana là model instruction-following, không dùng negative kiểu SDXL). Chỉ giữ vài negative thật cần: no text, no watermark, và no people / no characters (đây là ảnh bối cảnh trống)${ctx.eraRuleBg}
- ${ctx.bgLayout}
- 100-150 từ tiếng Anh
- Trả về CHỈ prompt text.`;
  state.assetBgPrompts[name] = await callClaude(promptText, 500);
  return { name, pulled: false };
}

async function genAllAssetPrompts(){
  const chars = document.getElementById('t3Characters').value.split('\n').map(s => s.trim()).filter(Boolean);
  const bgs = document.getElementById('t3Backgrounds').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (chars.length === 0 && bgs.length === 0) return setStatus3('Cần load nhân vật/bối cảnh trước.', 'error');

  const ctx = _t3StyleCtx();
  const { p, charStyle, charStyleB, bgStyle, rules, eraCtx, eraRule, eraRuleBg, bgLayout } = ctx;
  if (!charStyle && !bgStyle) return setStatus3('Cần có Style Prompts trong Profile.', 'error');

  setStatus3('AI đang tạo prompt reference sheets...', 'working');
  if (!state.assetCharPrompts) state.assetCharPrompts = {};
  if (!state.assetBgPrompts) state.assetBgPrompts = {};
  clearCancel();

  try {
    // Character prompts — chạy SONG SONG theo số key (mỗi nhân vật độc lập). Check Library → skip AI nếu có.
    let libPulledChars = 0;
    const charsToDo = chars.filter(rawName => {
      const name = rawName.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
      return !(state.assetCharPrompts[name] && state.assetCharPrompts[name].trim());
    });
    const charLanes = _concurrency();
    await runConcurrent(charsToDo, async (rawName) => {
      if (state.cancelRequested) return;
      const res = await genOneCharPrompt(rawName, ctx);
      if (res && res.pulled) libPulledChars++;
      renderAssetCharPrompts(chars);
      const done = Object.keys(state.assetCharPrompts).length;
      setStatus3(`Nhân vật ${done}/${chars.length}...${charLanes > 1 ? ` (⚡ ${charLanes} luồng)` : ''}${libPulledChars ? ` · 📚 ${libPulledChars} từ Library` : ''}`, 'working');
    }, charLanes, () => state.cancelRequested);
    if (state.cancelRequested) {
      clearCancel();
      setStatus3(`⏸ Đã dừng. Đã tạo ${Object.keys(state.assetCharPrompts).length}/${chars.length} prompt nhân vật. Bấm lại để chạy tiếp.`, 'info');
      saveState();
      return;
    }

    // Background prompts — GỘP tất cả vào 1 lần gọi API (tiết kiệm chi phí)
    let libPulledBgs = 0;
    const bgsToGen = []; // bối cảnh cần AI tạo (chưa có prompt, không trong Library)
    for (const name of bgs) {
      if (state.assetBgPrompts[name] && state.assetBgPrompts[name].trim()) continue;
      const libEntry = checkLibraryFor('bg', name);
      if (libEntry) {
        state.assetBgPrompts[name] = libEntry.prompt;
        libPulledBgs++;
        renderAssetBgPrompts(bgs);
        setStatus3(`📚 ${name}: pull từ Library (${libPulledBgs} bg đã pull)`, 'info');
        continue;
      }
      bgsToGen.push(name);
    }

    if (bgsToGen.length && !state.cancelRequested) {
      setStatus3(`Đang tạo ${bgsToGen.length} prompt bối cảnh (1 lần gọi)...`, 'working');
      const bgListStr = bgsToGen.map(n => `[${n}]`).join('\n');
      const batchBgPrompt = `Tạo prompt ảnh chi tiết cho NHIỀU background reference location dưới đây.

Style template:
"""
${bgStyle}
"""

NEGATIVE/RULES: ${rules}
Kênh: ${p?.tenKenh || ''} — ${p?.ngach || ''}${eraCtx}

Danh sách bối cảnh:
${bgListStr}

Với MỖI bối cảnh, tạo 1 prompt:
- Mô tả chi tiết môi trường, đồ vật, ánh sáng
- Ghi tên bối cảnh [tên] trong prompt
- NO characters NO people${eraRuleBg}
- ${bgLayout}
- 100-150 từ tiếng Anh mỗi prompt

Trả về JSON object, key là tên bối cảnh (không có ngoặc vuông), value là prompt text. VD: {"ship-cabin-night":"...","ship-deck-night":"..."}
CHỈ trả JSON, không giải thích.`;
      try {
        const reply = await callClaude(batchBgPrompt, 3000);
        const clean = reply.replace(/```json|```/g, '').trim();
        const obj = JSON.parse(clean);
        for (const name of bgsToGen) {
          if (obj[name] && typeof obj[name] === 'string') {
            state.assetBgPrompts[name] = obj[name].trim();
          }
        }
        renderAssetBgPrompts(bgs);
      } catch (e) {
        // Fallback: JSON lỗi → gọi từng cái
        console.warn('Batch BG lỗi, fallback từng cái:', e.message);
        for (const name of bgsToGen) {
          if (state.cancelRequested) break;
          await genOneBgPrompt(name, ctx, { forceAI: true });
          renderAssetBgPrompts(bgs);
        }
      }
    }

    // QUÉT LẠI: asset NÀO còn thiếu prompt (do lô rớt mạng) → thử lại tối đa 2 vòng (tránh "cần prompt" như traveler/bucees-interior).
    const _cn = rn => rn.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    for (let sweep = 0; sweep < 2 && !state.cancelRequested; sweep++){
      const missC = chars.filter(rn => !(state.assetCharPrompts[_cn(rn)] && state.assetCharPrompts[_cn(rn)].trim()));
      const missB = bgs.filter(nm => !(state.assetBgPrompts[nm] && state.assetBgPrompts[nm].trim()));
      if (!missC.length && !missB.length) break;
      if (typeof novaLog === 'function') novaLog(`↻ Còn ${missC.length} nhân vật + ${missB.length} bối cảnh thiếu mô tả — thử lại (vòng ${sweep + 1})…`, 'warn');
      const lanes2 = _concurrency();
      await runConcurrent(missC, async (rn) => { if (state.cancelRequested) return; try { await genOneCharPrompt(rn, ctx, { forceAI: true }); renderAssetCharPrompts(chars); } catch (e) { console.warn('char sweep:', e.message); } }, lanes2, () => state.cancelRequested);
      await runConcurrent(missB, async (nm) => { if (state.cancelRequested) return; try { await genOneBgPrompt(nm, ctx, { forceAI: true }); renderAssetBgPrompts(bgs); } catch (e) { console.warn('bg sweep:', e.message); } }, lanes2, () => state.cancelRequested);
    }
    const _mc = chars.filter(rn => !(state.assetCharPrompts[_cn(rn)] && state.assetCharPrompts[_cn(rn)].trim())).length;
    const _mb = bgs.filter(nm => !(state.assetBgPrompts[nm] && state.assetBgPrompts[nm].trim())).length;
    if ((_mc || _mb) && typeof novaLog === 'function') novaLog(`⚠️ Còn ${_mc} nhân vật + ${_mb} bối cảnh chưa có mô tả (mạng chập) — bấm "🔄 Viết lại mô tả" để bù.`, 'err');

    setStatus3(`✓ Đã tạo ${chars.length} prompt nhân vật + ${bgs.length} prompt bối cảnh.`, 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi: ' + e.message, 'error');
  }
}

async function genStyleReference(){
  const p = getProfile();
  if (!p) return setStatus3('Cần Profile.', 'error');
  setStatus3('AI đang tạo Style Reference prompt...', 'working');
  try {
    const prompt = `Tạo 1 prompt ảnh cho "Channel Visual Style Reference Sheet" — 1 ảnh master tóm tắt toàn bộ style visual của kênh, dùng làm chuẩn cho mọi video sau.

Kênh: ${p.tenKenh} — ${p.ngach}
Visual Style: ${p.visualStyle}
Character Style (ÁP DỤNG ĐẦY ĐỦ — đặc biệt cách dựng cơ thể, tay/chân, bàn tay và mặt): ${p.characterStyle || ''}
Background Style: ${(p.backgroundStyle || '').slice(0, 700)}
Scene Style: ${(p.sceneStyle || '').slice(0, 400)}

LAYOUT BẮT BUỘC — ảnh chia 3 hàng ngang rõ ràng, phân cách bằng đường kẻ mảnh:
- HÀNG 1 (trên cùng): color palette — 8 ô vuông màu đại diện cho bảng màu chủ đạo của kênh (lấy từ style), xếp ngang đều nhau
- HÀNG 2 (giữa): line-up 8 nhân vật mẫu đa dạng (nam/nữ, già/trẻ, các nghề khác nhau phù hợp ngách kênh) — TẤT CẢ cùng art style nhất quán, đứng full-body front view, nền trắng, có bóng đổ nhẹ dưới chân. CÁCH DỰNG CƠ THỂ của cả 8 nhân vật PHẢI đúng y hệt Character Style ở trên (vd nếu Character Style yêu cầu tay/chân là nét que đen mảnh + bàn tay mitten trắng + mặt off-white thì cả 8 đều phải vậy) — TUYỆT ĐỐI không vẽ thành người cartoon tỉ lệ thường
- HÀNG 3 (dưới cùng): 3 ô bối cảnh mẫu (3 môi trường tiêu biểu của kênh) với lighting và mood khác nhau, bo góc nhẹ

Prompt phải:
- Mô tả CHÍNH XÁC art style VÀ cách dựng cơ thể nhân vật (tay, chân, bàn tay, mặt) đúng theo Character Style ở trên — copy nguyên đặc điểm nhận diện, KHÔNG thay bằng tỉ lệ người cartoon thường
- Áp dụng đúng bảng màu và mood theo Visual Style
- 130-180 từ tiếng Anh
- Kết thúc bằng: "channel style reference sheet, consistent art style throughout, clean layout, no text, no title, no labels, no captions, no numbers, no watermark anywhere in the image, pure artwork only"
- Trả về CHỈ prompt text.`;
    state.styleRefPrompt = await callClaude(prompt, 600);
    document.getElementById('styleRefPanel').style.display = 'block';
    renderStyleRef();
    updateAllAssetPromptsBox();
    setStatus3('✓ Đã tạo Style Reference prompt (3 hàng: palette + nhân vật + bối cảnh).', 'ok');
    saveState();
  } catch (e) {
    console.error(e);
    setStatus3('Lỗi: ' + e.message, 'error');
  }
}

// === L?: const assetRenamer ===
const assetRenamer = { files: [] };

// === L?: const setStatus4 ===
const setStatus4 = (m, t) => setStatusBar('status4', m, t);

// === L?: const renamer ===
const renamer = { files: [] };

// === L?: const setStatus5 ===
const setStatus5 = (m, t) => setStatusBar('status5', m, t);

// === L?: const _T2_NGUON ===
const _T2_NGUON = [
  { id:'pexels',   ten:'Pexels',   video:true,  lay:'pexels.com/api',    mo:'ảnh + video' },
  { id:'pixabay',  ten:'Pixabay',  video:true,  lay:'pixabay.com/api/docs', mo:'ảnh + video' },
  { id:'unsplash', ten:'Unsplash', video:false, lay:'unsplash.com/developers', mo:'CHỈ ảnh' },
];

// === L?: let _t2StockTT ===
let _t2StockTT = {};

// === L?: const _T_NGUON_HONG ===
const _T_NGUON_HONG = () => _T2_NGUON.filter(n => _t2StockTT[n.id] && !_t2StockTT[n.id].ok).map(n => n.ten);

// === L?: let _t5Results ===
let _t5Results = {};

// === L?: const _T2_GOC_NHAN ===
const _T2_GOC_NHAN = { 'chu-the': 'chủ thể', 'boi-canh': 'bối cảnh', 'doi-chieu': 'đối chiếu' };

async function generateSearchAngles(voText, opts){
  const o = opts || {};
  const topic = String(state.videoLogline || '').trim();
  const vaiTro = o.role || ((state.aiMap || {})[o.sceneId] || {}).role || '';
  const truoc = String(o.truoc || '').trim(), sau = String(o.sau || '').trim();

  const prompt = `Bạn là người chọn hình cho video tài liệu. Sinh TỪ KHOÁ tìm kho stock.
${topic ? 'CHỦ ĐỀ CẢ VIDEO: ' + topic + '\n' : ''}${vaiTro ? 'VAI TRÒ CẢNH: ' + vaiTro + '\n' : ''}
CÂU THOẠI CẢNH NÀY: "${voText}"
${truoc ? 'Câu trước: "' + truoc + '"\n' : ''}${sau ? 'Câu sau: "' + sau + '"\n' : ''}
⚠️ BẪY THƯỜNG GẶP: câu thoại hay mượn một đồ vật để SO SÁNH ("rẻ hơn ly cà phê",
"to bằng cái xe buýt", "mỏng như tờ giấy"). Đồ vật đó KHÔNG phải chủ thể của cảnh —
chủ thể vẫn là thứ mà cả video đang nói tới. Lấy tám clip cà phê cho một video về
hàng không là sai. Nếu có đồ vật so sánh thì xếp nó vào góc "doi-chieu", KHÔNG được
để làm góc đầu tiên.

Trả về 2–3 GÓC TÌM khác nhau, mỗi góc 2–4 từ khoá tiếng Anh ngắn (danh từ cụ thể,
không tính từ mơ hồ). Được thêm ĐÚNG 1 từ khoá góc máy nếu thật hợp:
aerial, close-up, macro, top-down, timelapse, slow motion, handheld.

Các góc dùng được:
- "chu-the"   — thứ cảnh đang nói tới theo nghĩa đen. LUÔN có góc này, luôn đứng đầu.
- "boi-canh"  — nơi chốn / không khí bao quanh, để làm b-roll.
- "doi-chieu" — đồ vật dùng để so sánh hoặc ẩn dụ, CHỈ khi câu thoại thật sự có.

Trả JSON: [{"goc":"chu-the","q":"airline profit margin"},{"goc":"boi-canh","q":"airport terminal wide"}]`;

  try {
    const arr = await callLLMJson(prompt, { maxTokens: 300,
      validate: a => Array.isArray(a) && a.length > 0 && a.every(x => x && x.q) });
    const ok = ['chu-the', 'boi-canh', 'doi-chieu'];
    const ra = arr.map(x => ({ goc: ok.includes(x.goc) ? x.goc : 'chu-the', q: String(x.q || '').trim() }))
      .filter(x => x.q).slice(0, 3);
    // Ép chủ thể lên đầu: model đôi khi vẫn xếp đối chiếu trước dù đã dặn.
    ra.sort((a, b) => ok.indexOf(a.goc) - ok.indexOf(b.goc));
    return ra.length ? ra : null;
  } catch (_) { return null; }
}

async function generateSearchKeywords(voText, opts){
  // fallback: rút vài từ khoá từ chính VO nếu AI lỗi
  const fallback = () => (voText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 4).join(', ')) || voText.slice(0, 40);
  const o = opts || {};
  // Giữ tương thích: bậc cũ {broader:true} tương đương bậc 3.
  const bac = Number(o.bac) || (o.broader ? 3 : 1);
  const chuDe = String(state.videoLogline || '').trim();

  const LUAT = 'Quy tắc: chủ thể đứng ĐẦU. Trả JSON mảng, MỖI PHẦN TỬ LÀ MỘT từ khoá tiếng Anh ngắn '
    + '(2-4 phần tử), KHÔNG nhồi nhiều từ khoá vào một phần tử, KHÔNG lặp lại chủ thể ở nhiều phần tử. '
    + 'Kho ảnh tìm theo keyword chứ không hiểu câu văn — KHÔNG viết thành câu, KHÔNG tính từ mơ hồ '
    + '(beautiful, amazing, stunning). Có thể thêm 1 từ góc máy nếu hợp: aerial, close-up, timelapse, slow motion.';

  const P = {
    1: `Sinh 2-4 từ khoá tìm ảnh/video stock cho nội dung dưới — BẬC CHÍNH XÁC: đúng sự việc, nhân vật, hành động được nhắc tới.
${chuDe ? 'CHỦ ĐỀ CẢ VIDEO: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Trả JSON mảng chuỗi.
NỘI DUNG: "${voText}"`,

    2: `Từ khoá bậc chính xác cho "${voText}" đang ra 0 kết quả.
Sinh 2-4 từ khoá tiếng Anh cho BẬC BỐI CẢNH: đừng tìm chính sự việc nữa, tìm cảnh XUNG QUANH nó —
nơi chốn diễn ra, vật thể liên quan, đám đông, mặt tiền toà nhà, thiết bị, phương tiện.
Ví dụ: "phiên điều trần về hãng bay" → bậc 2 là "airport terminal exterior, airline counter, boarding gate".
${chuDe ? 'CHỦ ĐỀ CẢ VIDEO: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Trả JSON mảng chuỗi.`,

    3: `Hai bậc trước cho "${voText}" đều ra 0 kết quả.
Sinh 2-3 từ khoá tiếng Anh RỘNG và ĐƠN GIẢN nhất cho BẬC NỀN CHUNG: b-roll đẹp cùng chủ đề,
chấp nhận không khớp chi tiết, miễn là chắc chắn có trong kho stock.
${chuDe ? 'CHỦ ĐỀ CẢ VIDEO: "' + chuDe.slice(0, 200) + '"\n' : ''}${LUAT}
Trả JSON mảng chuỗi.`,
  };

  try {
    const arr = await callLLMJson(P[bac] || P[1], { maxTokens: 200, validate: a => Array.isArray(a) && a.length > 0 });
    /* Luật "chủ thể đứng ĐẦU" khiến model hay lặp lại chủ thể trước mỗi từ khoá:
       "Warren Buffett, portrait, Warren Buffett, speaking, Warren Buffett".
       Trùng lặp chỉ làm loãng truy vấn — bỏ trùng, không phân biệt hoa thường. */
    const thay = new Set();
    return arr
      .flatMap(s => String(s).split(','))        // mỗi phần tử có thể là "a, b, c" → tách ra đã
      .map(s => s.trim()).filter(Boolean)
      .filter(s => { const k = s.toLowerCase(); if (thay.has(k)) return false; thay.add(k); return true; })
      .slice(0, 5).join(', ');
  } catch (_) {
    return fallback();
  }
}

// === L?: const _KHO_CAM ===
const _KHO_CAM = /(^|[-\s])n[cd]([-\s]|$)|non[\s-]?commercial|no[\s-]?deriv/i;

// === L?: const _khoOk ===
const _khoOk = (lic) => {
  const s = String(lic || '').toLowerCase();
  if (!s) return false;
  if (_KHO_CAM.test(s)) return false;
  return /public domain|^cc0|cc0|^by($|[-\s])|cc by|^by-sa|attribution/i.test(s);
};

// === L?: const _khoText ===
const _khoText = (v) => String(v == null ? '' : v).replace(/<[^>]*>/g, '').trim();

// === L?: const _T2_CANH_ANH ===
const _T2_CANH_ANH = new Set(['compare', 'map', 'flashback']);

// === L?: const _T2_LOAI_NGUON ===
const _T2_LOAI_NGUON = [
  // Video ca nhạc / AMV / lyric — hình bám nhịp nhạc, cắt ra là lạc hẳn.
  { lop: 'nhac', chan: true, d: -10,
    re: /\b(amv|music video|official (?:video|audio)|lyrics?|lyric video|ost|soundtrack|full song|cover|remix|concert|live performance|instrumental|karaoke)\b/i },
  // Fan edit / tổng hợp — dính watermark, hiệu ứng, nhạc đè.
  { lop: 'fan-edit', chan: true, d: -9,
    re: /\b(compilation|fan ?edit|edits|tribute|highlights?|best (?:moments|scenes|of)|top \d+|scene ?pack|twixtor|must credit|free clips)\b/i },
  // Gameplay / sản phẩm — không phải cảnh quay đời thực.
  { lop: 'game', chan: true, d: -9,
    re: /\b(gameplay|walkthrough|speedrun|let'?s play|board game|card game|mod showcase|cheat)\b/i },
  // Đăng lại từ mạng xã hội — gần như luôn có watermark.
  { lop: 'repost-mxh', chan: true, d: -8,
    re: /\b(tiktok|capcut|reels?|shorts? compilation|repost)\b/i },
  // Trailer fan làm / live action tự dựng.
  { lop: 'fan-trailer', chan: true, d: -8,
    re: /\b(fan ?(?:trailer|made|film)|concept trailer|live action (?:remake|version)|imagined cast)\b/i },
  // Người ngồi nói — trừ điểm nặng nhưng KHÔNG chặn: đôi khi có b-roll xen giữa.
  { lop: 'binh-luan', chan: false, d: -6,
    re: /\b(interview|podcast|reaction|reacts?|vlog|talking head|explains?|explained|review|unboxing|q&a|ama|livestream|live stream|commentary|analysis|breakdown|recap|video essay|my thoughts|face ?cam|webcam)\b/i },
  // Hướng dẫn / bài giảng — khung hình là màn chiếu hoặc bảng, không phải cảnh thật.
  { lop: 'huong-dan', chan: false, d: -4,
    re: /\b(tutorial|lesson|course|module|seminar|webinar|lecture|training video|how to|step by step)\b/i },
  // Hậu trường / tin quảng bá.
  { lop: 'hau-truong', chan: false, d: -3,
    re: /\b(behind the scenes|making of|bloopers?|fan art|press junket)\b/i },
];

// === L?: const _T2_TIEU_DE_CHUNG ===
const _T2_TIEU_DE_CHUNG = /\b(part \d+|full (?:episode|video)|mix \d+|shorts?)\b/i;

// === L?: const _T2_TIEU_DE_TOT ===
const _T2_TIEU_DE_TOT = /\b(4k|uhd|1080p|60fps|no copyright|copyright[- ]free|free stock|royalty[- ]free|b[- ]?roll|stock footage|aerial|drone|timelapse)\b/i;

// === L?: const _T2_LY_DO ===
const _T2_LY_DO = {
  'qua-ngan':    'clip ngắn hơn cảnh',
  'trung-lap':   'đã dùng ở cảnh khác',
  'rong':        'ứng viên rỗng',
  'nhac':        'video ca nhạc / AMV',
  'fan-edit':    'fan edit / tổng hợp',
  'game':        'gameplay',
  'repost-mxh':  'đăng lại từ mạng xã hội',
  'fan-trailer': 'trailer fan làm',
};

// === L?: const _T2_STOCK_MAX ===
const _T2_STOCK_MAX = 24;

// === L?: const _T2_WEB_MAX ===
const _T2_WEB_MAX = 18;

// === L?: function _t2WebPickerRender ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=4968c, shared=4955c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _t2WebPickerRender(sceneId, note){
  const m = document.getElementById('t2WebPickerModal'); if (!m) return;
  const cands = (state.webCandidates || {})[sceneId] || [];
  const so = (state.scenes || []).findIndex(s => s.id === sceneId) + 1;
  const dung = (state.mediaPicks || {})[sceneId] || {};
  const dangDung = dung.trangUrl || '';

  const the = cands.map((c, i) => {
    const chon = dangDung && (c.trangUrl === dangDung);
    const gp = c.license ? escapeHtml(String(c.license).slice(0, 30)) : '';
    const tg = c.author ? escapeHtml(String(c.author).slice(0, 26)) : '';
    const rui = c.nhom && c.nhom !== 'cong';
    return `<div style="width:212px;border-radius:9px;overflow:hidden;border:2px solid ${chon ? 'var(--accent)' : 'var(--border)'};background:var(--surface-2);display:flex;flex-direction:column">
      <div onclick="t2PickWeb('${sceneId}',${i})" style="cursor:pointer;position:relative;height:120px;background:#000">
        ${c.thumb ? `<img src="${escapeHtml(c.thumb)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.style.opacity=.15">`
                  : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:22px">🌐</div>'}
        <span style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,.68);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px">${c.duration ? c.duration + 's' : 'video'}</span>
        ${chon ? '<span style="position:absolute;top:6px;right:6px;background:var(--accent);color:#000;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">✓ Đang dùng</span>' : ''}
        ${c.camTM ? '<span title="Giấy phép CẤM dùng thương mại hoặc cấm sửa đổi — kênh bật kiếm tiền dùng là vi phạm. Lượt tự động đã bỏ qua thẻ này." style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.8);color:#ff6b6b;font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px">⛔ cấm thương mại</span>'
          : (rui ? '<span title="Nội dung có bản quyền — cân nhắc khi bật kiếm tiền" style="position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.68);color:var(--amber);font-size:10px;padding:2px 5px;border-radius:4px">⚠️ bản quyền</span>' : '')}
      </div>
      <div style="padding:6px 8px;font-size:10.5px;color:var(--text-muted);line-height:1.45;flex:1 1 auto">
        <div style="font-weight:650;color:var(--text);max-height:28px;overflow:hidden">${escapeHtml(String(c.ten || '').slice(0, 62))}</div>
        <div style="margin-top:3px">${_srcBadge(c.source)}</div>
        ${gp ? `<div style="color:var(--teal)">📄 ${gp}</div>` : ''}
        ${tg ? `<div style="color:var(--text-dim)">© ${tg}</div>` : ''}
      </div>
      <div style="display:flex;gap:4px;padding:0 8px 8px">
        <button class="btn ghost sm" style="flex:1;font-size:10.5px;padding:4px" onclick="t2PickWeb('${sceneId}',${i})">Dùng cảnh này</button>
        <button class="btn ghost sm" style="font-size:10.5px;padding:4px 7px" title="Mở trang gốc trong trình duyệt" onclick="event.stopPropagation();window.open('${escapeHtml(c.trangUrl || '')}','_blank')">↗</button>
      </div>
    </div>`;
  }).join('');

  const nhip = (typeof webTrangThaiNhip === 'function') ? webTrangThaiNhip() : null;
  const nhipTxt = nhip ? `Tìm web đã dùng ${nhip.daDung}/${nhip.tran} lượt phiên này${nhip.chan ? ' · <span style="color:var(--amber)">đang bị chặn nhịp</span>' : ''}.` : '';
  m.innerHTML = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;width:min(940px,96vw);max-height:88vh;display:flex;flex-direction:column;overflow:hidden" onclick="event.stopPropagation()">
    <div style="padding:15px 18px 10px;border-bottom:1px solid var(--border);flex:0 0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:14.5px;font-weight:750">🌐 Tư liệu web — cảnh ${so}</span>
      <span style="font-size:11px;color:var(--text-dim)">${cands.length} ứng viên</span>
      <span style="flex:1"></span>
      <input id="t2WebKw" placeholder="Gõ từ khoá tiếng Anh rồi bấm Tìm thêm" style="background:var(--surface-2);border:1px solid var(--border-2);border-radius:8px;padding:6px 10px;font-size:12px;width:250px">
      <button class="btn ghost sm" id="t2WebMoreBtn" onclick="t2WebTimThem('${sceneId}')">🔎 Tìm thêm</button>
      <button class="btn ghost sm" onclick="webMoBang()">⚙ Nền tảng</button>
      <button class="btn ghost sm" onclick="t2CloseWebPicker()">Đóng</button>
    </div>
    <div id="t2WebNote" style="padding:8px 18px 0;font-size:11px;color:var(--text-dim);line-height:1.55;flex:0 0 auto">${note ? escapeHtml(note) + '<br>' : ''}${nhipTxt}</div>
    <div style="padding:12px 18px 16px;overflow:auto;flex:1 1 auto;display:flex;flex-wrap:wrap;gap:10px">${the || '<div style="color:var(--text-dim);font-size:12px">Chưa có ứng viên nào.</div>'}</div>
  </div>`;
}

async function downloadMedia(url, kind, sceneNum){
  if (!url) return setStatus5('Không có link tải.', 'error');
  setStatus5('Đang tải...', 'working');
  let ext = (url.split('?')[0].match(/\.(jpg|jpeg|png|webp|mp4|mov|webm)$/i) || [])[1];
  if (!ext) ext = (kind === 'mp4') ? 'mp4' : 'jpg';
  ext = ext.toLowerCase();
  // Tên file = số cảnh (001, 002...) nếu có, fallback timestamp
  const baseName = sceneNum ? String(sceneNum).padStart(3, '0') : `stock-${Date.now()}`;
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const a = document.createElement('a');
    const objUrl = URL.createObjectURL(blob);
    a.href = objUrl;
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    setStatus5(`✓ Đã tải về: ${baseName}.${ext}`, 'ok');
  } catch (e) {
    window.open(url, '_blank');
    setStatus5('Mở link ở tab mới để tải (CORS chặn tải trực tiếp).', 'info');
  }
}

// === L?: const setStatus6 ===
const setStatus6 = (m, t) => setStatusBar('statusMvVid', m, t);

async function genSingleVeoPrompt(id){
  const p = getProfile();
  if (!p) return setStatus6('Cần Profile (Tool 1) trước.', 'error');
  const idx = state.scenes.findIndex(s => s.id === id);
  if (idx < 0) return;
  const scene = state.scenes[idx];
  const dur = getSceneDuration(scene);
  const aspectRatio = document.getElementById('v6AspectRatio')?.value || '16:9';
  const audioMode = document.getElementById('v6AudioMode')?.value || 'none';
  const audioLine = audioMode === 'none' ? 'KHÔNG thêm dòng audio.' : 'Thêm dòng "Audio: [mô tả ambient music + sfx phù hợp scene]" cuối prompt.';
  const gLabsPrompt = state.scenePrompts[id] ? `\nG-Labs prompt (tham khảo style): ${state.scenePrompts[id].slice(0, 200)}` : '';
  setStatus6(`Đang tạo prompt Veo 3 cảnh [${id}]...`, 'working');
  try {
    const prompt = `Bạn là Veo 3 prompt engineer. Tạo 1 prompt video cho cảnh sau.
Profile: ${p.tenKenh} | Style: ${p.sceneStyle || '2D animated'} | Rules: ${p.promptRules || ''}
Nhân vật: ${state.charactersV.join(', ') || '-'} | Bối cảnh: ${state.backgroundsV.join(', ') || '-'}
Aspect ratio: ${aspectRatio} | Audio: ${audioMode === 'none' ? 'không' : 'có'}

Cảnh [${id}]: VO: "${scene.text}" | nhân vật: ${scene.character || '-'} | bối cảnh: ${scene.background || '-'} | camera: ${scene.camera} | duration: ${dur}s${gLabsPrompt}

Yêu cầu: Subject+Action+CameraMovement+Lighting+Style. ${audioLine}
70-130 từ tiếng Anh. Bắt đầu ngay bằng mô tả visual. Trả về CHỈ text prompt, không JSON.`;
    const reply = await callClaude(prompt, 600);
    const clean = cleanPrompt(reply.trim());
    if (clean) {
      if (!state.veoPrompts) state.veoPrompts = {};
      state.veoPrompts[id] = { prompt: clean };
      renderVeoPrompts();
      renderVeoStats();
      setStatus6(`✓ Đã tạo prompt Veo 3 cảnh [${id}].`, 'ok');
      saveState(true);
    } else {
      setStatus6(`⚠️ Cảnh [${id}] tạo lỗi, thử lại.`, 'error');
    }
  } catch(e) {
    console.error(e);
    setStatus6('Lỗi: ' + e.message, 'error');
  }
}

// === L?: const t7State ===
const t7State = {
  images: [],        // giữ tương thích chỗ reset ở newVideo/switchVideo
  clips: [], selClip: null, past: [], future: [], _seq: 0,
  overlays: [], selOverlay: null,   // 🖼 Lớp trên (ảnh đè full-frame): {id,dataUrl,name,start,dur}
  media: [], mediaTab: 'scenes',    // 📁 Thư viện phương tiện nhập vào: {id,kind:image|video|audio,name,dataUrl,dur}
  audioFile: null, audioPeaks: null, audioDur: 0,
  bgmFile: null, bgmPeaks: null, bgmDur: 0,
  selId: null,
  playing: false, playT: 0, pps: 8, _t0: 0, _raf: null, _progHooked: false, _kbHooked: false,
  _drag: null
};

// === L?: const _T7_RAIL ===
const _T7_RAIL = [
  { k: 'scenes', ic: '🎬', lb: 'Cảnh' },
  { k: 'media',  ic: '🖼', lb: 'Ảnh' },
  { k: 'sep' },
  { k: 'text',   ic: 'T',  lb: 'Chữ' },
  { k: 'motion', ic: '✨', lb: 'Chuyển động' },
  { k: 'trans',  ic: '⇄',  lb: 'Chuyển cảnh' },
  { k: 'sep' },
  { k: 'audio',  ic: '🔊', lb: 'Âm thanh' },
  { k: 'subs',   ic: '💬', lb: 'Phụ đề' },
  { k: 'ai',     ic: '🪄', lb: 'Trợ lý' },
];

// === L?: const _t7IsTextTpl ===
const _t7IsTextTpl = (t) => !/vignette|film-grain|light-leak|blur-background|gradient-wipe|zoom-in|progress|circle|frame|khung/i.test(t.template + ' ' + (t.label || ''));

// === L?: const _T7_GUT ===
const _T7_GUT = (() => {
  try {
    const el = document.getElementById('tool-tool7');
    const v = el && getComputedStyle(el).getPropertyValue('--t7-gut');
    const n = parseFloat(v); if (Number.isFinite(n)) return n + 5;
  } catch (e) {}
  return 31;
})();

// === L?: let _t7Sfx, _t7RailQ ===
let _t7Sfx = null, _t7RailQ = '';

// === L?: const _T7_TABS ===
const _T7_TABS = ['scenes','media','text','motion','trans','audio','subs','ai'];

// === L?: const _T7_TITLE ===
const _T7_TITLE = { scenes:'Cảnh', media:'Ảnh', text:'Chữ', motion:'Chuyển động', trans:'Chuyển cảnh', audio:'Âm thanh', subs:'Phụ đề', ai:'Trợ lý' };

// === L?: let _t7GfxSel ===
let _t7GfxSel = null;

// === L?: function _t7LayerPanel ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=9676c, shared=7840c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _t7LayerPanel(L, ctx){
  const cat = (_t7Cat || []).find(x => x.template === L.template);
  const esc = (v) => escapeHtml(v == null ? '' : String(v));
  const lb = (t, extra) => `<div style="font-size:9.5px;letter-spacing:.4px;text-transform:uppercase;color:var(--text-muted);margin:9px 0 4px;font-weight:700;display:flex;justify-content:space-between"><span>${t}</span><span style="text-transform:none;letter-spacing:0;font-weight:400;color:var(--text-dim)">${extra || ''}</span></div>`;
  // Ô ảnh: nút chọn file thay vì bắt gõ data URL. Ô còn lại là ô chữ thường.
  const IMGK = /^(src|image|img|photo|logo|thumb)$/i;
  const fld = (k, v) => IMGK.test(k)
    ? `<div style="display:flex;gap:6px;align-items:center">
         <div class="t7-mfield" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;padding:7px 9px">${v === '@scene' ? '🖼 ảnh của cảnh' : (v ? (String(v).startsWith('data:') ? '🖼 ảnh đã chọn' : (_t7IsVid(v) ? '🎬 ' + esc(String(v).split(/[\\/]/).pop()) : esc(String(v).slice(0, 40)))) : '— chưa có ảnh/video —')}</div>
         <button class="btn ghost sm" style="padding:5px 9px;font-size:11px" onclick="t7LPickImg('${k}')" title="Ảnh — nhúng thẳng vào dự án">🖼 Ảnh</button>
         <button class="btn ghost sm" style="padding:5px 9px;font-size:11px" onclick="t7LPickVid('${k}')" title="Video — lưu đường dẫn, lúc xuất tự chép vào bản dựng">🎬 Video</button>
         ${ctx.scene ? `<button class="btn ghost sm" style="padding:5px 8px;font-size:11px" title="Dùng chính ảnh của cảnh này" onclick="t7LUseSceneImg('${k}')">🖼</button>` : ''}
         ${v ? `<button class="btn ghost sm" style="padding:5px 8px;font-size:11px;color:var(--red)" onclick="t7LSet('${k}','')">✕</button>` : ''}
       </div>`
    : `<input class="t7-mfield" style="width:100%" value="${esc(v)}" onchange="t7LSet('${k}',this.value)">`;

  // Ô nội dung: đúng những trường mẫu khai, bỏ các trường màu (đưa xuống nhóm Màu).
  const COLORK = /^(bg|ink|color|color2|track|mark|fill)$/;
  const params = (cat && cat.params) || Object.keys(L).filter(k => !/^(template|type|at|until|z|id|in|out|hold|box|style|dx|dy|scale|rotate|opacity)$/.test(k));
  const content = params.filter(k => !COLORK.test(k)).map(k => lb(k) + fld(k, L[k])).join('');
  const colors = params.filter(k => COLORK.test(k));

  const chip = (grp, val, label, cur) =>
    `<span class="t7-cchip${cur === val ? ' on' : ''}" onclick="t7LAnim('${grp}','${val}')">${label}</span>`;
  const IN = [['fade','mờ dần'],['rise','dâng lên'],['drop','rơi xuống'],['slideL','trượt trái'],['slideR','trượt phải'],['pop','bật'],['defocus','nhoè'],['wipeL','quét ngang'],['zoom','phóng vào'],['deal','chia bài'],['none','không']];
  const OUT = [['fade','mờ dần'],['sinkL','chìm trái'],['sinkR','chìm phải'],['fall','rơi xuống'],['shrink','co lại'],['wipeR','quét'],['none','không']];
  const HOLD = [['none','không'],['kenIn','Ken Burns – phóng vào'],['kenOut','Ken Burns – phóng ra'],['panL','lia trái'],['panR','lia phải'],['panU','lia lên'],['panD','lia xuống'],['drift','trôi'],['breathe','thở'],['growX','chạy đầy ngang'],['growY','chạy đầy dọc']];
  const curIn = (L.in && L.in.preset) || 'fade', curOut = (L.out && L.out.preset) || 'none', curHold = (L.hold && L.hold.preset) || 'none';

  // ── Vị trí / cỡ / độ mờ: mẫu tự dựng bố cục, các ô này ĐÈ LÊN bố cục đó ──
  const b = L.box || {};
  const B = (k, ph) => { const cur = _t7BoxRead(L, k);
    return `<input class="t7-mfield" style="width:100%" type="number" step="1" placeholder="${ph}" value="${cur != null ? esc(cur) : ''}" onchange="t7LBox('${k}',this.value)">`; };
  const N = (k, ph, step, dflt) => `<input class="t7-mfield" style="width:100%" type="number" step="${step}" placeholder="${ph}" value="${L[k] != null ? esc(L[k]) : ''}" onchange="t7LNum('${k}',this.value,${dflt})">`;
  const aBtn = (k, v, lbl) => `<span class="t7-cchip${(b[k] || (k === 'align' ? 'left' : 'top')) === v ? ' on' : ''}" onclick="t7LBoxSet('${k}','${v}')">${lbl}</span>`;
  const opa = Math.round((L.opacity != null ? Number(L.opacity) : 1) * 100);
  const layout = `<details class="t7-sect">
    <summary><span><b>📐 Vị trí &amp; cỡ</b><em>Đè lên bố cục mẫu — tính theo % khung hình nên đổi 16:9 ↔ 9:16 vẫn đúng chỗ.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2">
      <div class="t7-g2"><div>${lb('X (%)')}${B('x','8')}</div><div>${lb('Y (%)')}${B('y','8')}</div></div>
      <div class="t7-g2"><div>${lb('Rộng (%)')}${B('w','tự')}</div><div>${lb('Cao (%)')}${B('h','tự')}</div></div>
      ${lb('Canh chữ trong hộp')}<div style="display:flex;gap:4px;flex-wrap:wrap">${aBtn('align','left','trái')}${aBtn('align','center','giữa')}${aBtn('align','right','phải')}</div>
      ${lb('Canh dọc')}<div style="display:flex;gap:4px;flex-wrap:wrap">${aBtn('vAlign','top','trên')}${aBtn('vAlign','center','giữa')}${aBtn('vAlign','bottom','dưới')}</div>
      <div class="t7-g3" style="margin-top:4px">
        <div>${lb('Cỡ ×')}${N('scale','1','0.05',1)}</div>
        <div>${lb('Xoay °')}${N('rotate','0','1',0)}</div>
        <div>${lb('Mờ %')}<input class="t7-mfield" style="width:100%" type="number" min="0" max="100" step="5" value="${opa}" onchange="t7LNum('opacity',this.value===''?'':(parseFloat(this.value)/100),1)"></div>
      </div>
      <div class="t7-g2"><div>${lb('Dịch ngang %')}${N('dx','0','1',0)}</div><div>${lb('Dịch dọc %')}${N('dy','0','1',0)}</div></div>
      <div style="display:flex;gap:5px;margin-top:7px">
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px;border-color:var(--accent);color:var(--accent)" onclick="t7LPin()" title="Hiện khung 8 nút trên bản xem trước để kéo bằng chuột">📌 Kéo trên khung</button>
        <button class="btn ghost sm" style="flex:1;padding:5px;font-size:11px" onclick="t7LReset()">↺ Về bố cục gốc</button>
      </div>
    </div>
  </details>`;

  return `<details class="t7-sect" open>
    <summary><span><b>✏️ Nội dung lớp</b><em>${esc((cat && cat.label) || L.template || L.type)} — ô do chính mẫu khai.</em></span><span class="cv">⌃</span></summary>
    <div class="bd2">${content || '<div class="t7-dim" style="font-size:11.5px">Mẫu này không có ô điền.</div>'}</div>
  </details>
  ${layout}
  ${colors.length ? `<details class="t7-sect">
    <summary><span><b>🎨 Màu</b><em>Đè lên màu mặc định của mẫu.</em></span><span class="cv">⌄</span></summary>
    <div class="bd2"><div class="t7-g2">${colors.map(k => `<div>${lb(k)}<div style="display:flex;gap:5px;align-items:center"><input type="color" style="width:30px;height:28px;padding:0;border:1px solid var(--border);border-radius:6px;background:none;cursor:pointer" value="${esc(/^#[0-9a-f]{6}$/i.test(L[k] || '') ? L[k] : ((cat && cat.defaults && cat.defaults[k]) || '#888888'))}" onchange="t7LSet('${k}',this.value)"><input class="t7-mfield" style="flex:1;min-width:0;font-family:monospace;font-size:11px" value="${esc(L[k] || '')}" placeholder="mặc định" onchange="t7LSet('${k}',this.value)"></div></div>`).join('')}</div></div>
  </details>` : ''}
  <details class="t7-sect" open>
    <summary><span><b>🎞 Chuyển động</b><em>Chọn theo TÊN trong bảng hiệu ứng cố định.</em></span><span class="cv">⌃</span></summary>
    <div class="bd2">
      ${lb('Vào', IN.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${IN.map(([v,l]) => chip('in', v, l, curIn)).join('')}</div>
      ${lb('Ra', OUT.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${OUT.map(([v,l]) => chip('out', v, l, curOut)).join('')}</div>
      ${lb('Giữ', HOLD.length + ' kiểu')}<div style="display:flex;gap:4px;flex-wrap:wrap">${HOLD.map(([v,l]) => chip('hold', v, l, curHold)).join('')}</div>
    </div>
  </details>
  ${ctx.timing || ''}${ctx.tail || ''}`;
}

// === L?: let _t7FxTab, _t7Bits, _t7Prev ===
let _t7FxTab = 'tpl', _t7Bits = null, _t7Prev = null;

// === L?: let _t7AB ===
let _t7AB = null;

// === L?: const _T7_FLASH ===
const _T7_FLASH = {
  'dip-black':'#000', 'dip-white':'#fff', 'flashbang':'#fff', 'glare':'#fff5d0',
  'strobe':'#fff', 'burn':'#ff7a2f', 'film-roll':'#0a0806', 'shutter':'#0a0806', 'reverse-shutter':'#0a0806',
};

// === L?: const _T7_ANIMFAM ===
const _T7_ANIMFAM = { wipe:'f-wipe', push:'f-push', whip:'f-whip', zoom:'f-zoom', shape:'f-shape',
  split:'f-split', glitch:'f-glitch', compress:'f-compress', flip:'f-flip', sweep:'f-sweep', camera:'f-zoom' };

async function t7FxTab(which){
  // Tên cũ ('tpl'/'tr'/'bit') vẫn nhận để không phá chỗ gọi cũ; tên mới đến từ rail.
  const MAP = { tpl: 'motion', bit: 'motion', tr: 'trans' };
  _t7FxTab = MAP[which] || which || 'motion';
  ['t7FxTabT','t7FxTabR','t7FxTabB'].forEach((id, k) => {
    const b = document.getElementById(id); if (b) b.classList.toggle('on', ['motion','trans','motion'][k] === _t7FxTab);
  });
  const box = document.getElementById('t7FxList'); if (!box) return;
  box.innerHTML = '<div class="t7-dim" style="font-size:11.5px;padding:8px">Đang nạp…</div>';
  await _t7LoadFx();
  const esc = escapeHtml;
  const sel = t7State.clips.find(x => x.id === t7State.selClip);
  const head = sel
    ? `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">Bấm để thêm vào <b style="color:var(--text)">cảnh ${esc(sel.sceneId)}</b>.</div>`
    : `<div class="t7-dim" style="font-size:11px;margin-bottom:8px">⚠️ Chọn một cảnh trước đã.</div>`;
  let html = head;
  const _q = _t7RailQ;
  const _hit = (s) => !_q || String(s || '').toLowerCase().includes(_q);
  if (_t7FxTab === 'tpl' || _t7FxTab === 'motion' || _t7FxTab === 'text'){
    const cat = (_t7Cat || []).filter(t => (_t7FxTab !== 'text' || _t7IsTextTpl(t)) && _hit(t.label + ' ' + t.template));
    html += '<div class="t7-fxgrid">' + cat.map(t => {
      const im = _t7Prev['tpl_' + t.template];
      return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'tpl','${esc(t.template)}')" onclick="t7FxAddTpl('${esc(t.template)}')" title="${esc((t.params||[]).join(' · '))} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
        <div class="pv">${im ? `<img src="${im}" loading="lazy">` : '<span>—</span>'}</div>
        <div class="nm">${esc(t.label)}</div></div>`;
    }).join('') + '</div>';
    // Nhóm "Chuyển động" gộp luôn bit Remotion — trước phải bấm sang tab con khác mới thấy.
    if (_t7FxTab !== 'text'){
      const bits = (_t7Bits || []).filter(_hit);
      if (bits.length) html += `<div class="t7-dim" style="font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;margin:12px 0 5px;font-weight:700">Bit Remotion · ${bits.length}</div>`
        + '<div class="t7-fxgrid">' + bits.map(b => {
          const im = _t7Prev['bit_' + b];
          return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'bit','${esc(b)}')" onclick="t7FxAddBit('${esc(b)}')" title="${esc(b)} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
            <div class="pv">${im ? `<img src="${im}" loading="lazy">` : '<span>—</span>'}</div>
            <div class="nm">${esc(b)}</div></div>`;
        }).join('') + '</div>';
    }
    if (!cat.length && (_t7FxTab === 'text' || !(_t7Bits || []).length)) html += '<div class="t7-dim" style="font-size:11.5px">Không có mẫu nào khớp.</div>';
  } else if (_t7FxTab === 'tr' || _t7FxTab === 'trans'){
    const fam = {};
    (_t7Trans || []).filter(t => _hit(t.label + ' ' + t.id)).forEach(t => { (fam[t.family] = fam[t.family] || []).push(t); });
    html += Object.keys(fam).map(f =>
      `<div class="t7-dim" style="font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;margin:9px 0 4px;font-weight:700">${esc(_T7_FAM[f] || f)}</div>` +
      fam[f].map(t => `<div class="t7-fxi" onclick="t7FxSetTrans('${esc(t.id)}')" title="${esc(t.description || '')}">
        <b>${esc(t.label)}</b><s>${t.durationSec}s</s></div>`).join('')).join('');
  } else {
    html += _t7Bits.length
      ? '<div class="t7-fxgrid">' + _t7Bits.map(b => {
          const im = _t7Prev['bit_' + b];
          return `<div class="t7-fxc" draggable="true" ondragstart="t7FxDrag(event,'bit','${esc(b)}')" onclick="t7FxAddBit('${esc(b)}')" title="${esc(b)} — bấm để thêm, hoặc kéo xuống rãnh Đồ hoạ">
            <div class="pv">${im ? `<img src="${im}" loading="lazy">` : '<span>—</span>'}</div>
            <div class="nm">${esc(b)}</div></div>`;
        }).join('') + '</div>'
      : '<div class="t7-dim" style="font-size:11.5px">Không nạp được danh sách bit (khởi động lại app).</div>';
  }
  box.innerHTML = html;
}

// === L?: let _t7Drag ===
let _t7Drag = null;

// === L?: function t7TransJump ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-t7.js (peer=246c, shared=215c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function t7TransJump(clipId){
  t7State.selClip = clipId; _t7GfxSel = null; _t7GlobSel = null;
  t7RenderDetail(); t7RenderTimeline();
  setStatus7('Chọn kiểu ở ô "Chuyển cảnh vào" bên phải — 38 kiểu.', 'ok');
}

// === L?: let _t7Clip ===
let _t7Clip = null;

// === L?: let _t7GlobSel ===
let _t7GlobSel = null;

// === L?: const _t7IsVid ===
const _t7IsVid = (v) => /\.(mp4|mov|webm|m4v|mkv)(\?|#|$)/i.test(String(v || ''));

// === L?: let _t7SmartWired ===
let _t7SmartWired = false;

// === L?: const T7_NOVA ===
const T7_NOVA = { fps: 30, width: 1920, height: 1080, comp: 'NovaSequence' };

// === L?: const _T7_HOLD ===
const _T7_HOLD = {
  'zoom-in': 'kenIn',  'zoom-out': 'kenOut',
  'pan-left': 'panL',  'pan-right': 'panR',
  'pan-up': 'panU',    'pan-down': 'panD',
  'none': 'none',
};

// === L?: const _T7_IN ===
const _T7_IN = { fade:'fade', dissolve:'fade', slide:'slideL', wipe:'wipeL', circle:'pop', none:'none' };

// === L?: let _t7Trans ===
let _t7Trans = null;

// === L?: const _T7_TRANS_FALLBACK ===
const _T7_TRANS_FALLBACK = [
  { id:'cut', label:'Cắt thẳng', family:'cut' }, { id:'fade', label:'Mờ dần', family:'dissolve' },
  { id:'dip-black', label:'Nhúng đen', family:'dissolve' }, { id:'slide-left', label:'Trượt trái', family:'push' },
  { id:'wipe-left', label:'Gạt trái', family:'wipe' }, { id:'iris', label:'Vòng tròn', family:'shape' },
];

// === L?: const _T7_FAM ===
const _T7_FAM = { cut:'Cắt', dissolve:'Hoà tan', camera:'Máy quay', push:'Đẩy', wipe:'Gạt', split:'Tách đôi',
  whip:'Quật nhanh', flip:'Lật', shape:'Hình khối', flash:'Chớp sáng', glitch:'Nhiễu số', zoom:'Phóng',
  sweep:'Quét', film:'Chất phim', blend:'Chồng ảnh', compress:'Bóp' };

// === L?: const _t7BlobUrls ===
const _t7BlobUrls = new Map();

// === L?: let _t7Cat ===
let _t7Cat = null;

// === L?: let _t7AiQ ===
let _t7AiQ = [];

// === L?: const _T7_AI_STEP ===
const _T7_AI_STEP = ['Đọc kịch bản', 'Lập bản đồ vai trò cảnh', 'Đề xuất mẫu chuyển động',
                     'Soi khung hình cảnh có chữ', 'Tự kiểm cả kế hoạch', 'Chọn chuyển cảnh'];

// === L?: let _t7AiNote ===
let _t7AiNote = {};

// === L?: let _t7AiBulk ===
let _t7AiBulk = false;

// === L?: const _t7AiPv ===
const _t7AiPv = new Map();

// === L?: let _t7AiPlay ===
let _t7AiPlay = null;

// === L?: let _t7AiTry ===
let _t7AiTry = null;

// === L?: const _t7AiTStill ===
const _t7AiTStill = (dur) => Math.min(0.75, Math.max(0.3, dur * 0.35));

// === L?: let _t7AiObs ===
let _t7AiObs = null;

// === L?: const _T7_ENUM ===
const _T7_ENUM = {
  position: ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'],
  pos: ['top', 'center', 'bottom'],
  from: ['left', 'right', 'top', 'bottom'],
  side: ['top', 'bottom', 'left', 'right'],
  animation: ['slide-in', 'fade-in', 'pop-in', 'typewriter', 'bounce-in', 'rise-in'],
  dir: ['up', 'down', 'left', 'right'],
  mode: ['hot', 'cold'],
};

// === L?: const _T7_NHAN ===
const _T7_NHAN = {
  text: 'Chữ', subtitle: 'Dòng phụ', headline: 'Tiêu đề', title: 'Tiêu đề', value: 'Số',
  unit: 'Đơn vị', kicker: 'Nhãn trên', note: 'Ghi chú', caption: 'Chú thích', label: 'Nhãn',
  name: 'Tên', body: 'Nội dung', dek: 'Mô tả', chip: 'Thẻ', stamp: 'Con dấu', range: 'Khoảng',
  role: 'Vai', date: 'Ngày', position: 'Vị trí', pos: 'Vị trí', from: 'Vào từ', side: 'Phía',
  animation: 'Kiểu vào', size: 'Cỡ', color: 'Màu chữ', bg: 'Màu nền', accent: 'Màu nhấn',
  ink: 'Màu mực', track: 'Màu rãnh', mark: 'Màu bôi', color2: 'Màu 2', thickness: 'Độ dày',
  alpha: 'Độ đậm', strength: 'Độ mạnh', blur: 'Độ mờ', amount: 'Mức', angle: 'Góc',
  speed: 'Tốc độ', inner: 'Lõi', dir: 'Hướng', mode: 'Kiểu', x: 'X', y: 'Y', w: 'Rộng', h: 'Cao',
};

// === L?: function _t7AiEditCustom ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1911c, shared=1800c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _t7AiEditCustom(q, i){
  return (q.custom || []).map((L, j) => {
    const o = (key, nhan, kind, val, chon) => {
      const id = `cu${i}_${j}_${key}`;
      const set = `t7AiCustomSet(${i},${j},'${key}',this.value)`;
      if (kind === 'chon')
        return `<label for="${id}">${nhan}</label><select id="${id}" onchange="${set}">${
          chon.map(x => `<option${String(val) === x ? ' selected' : ''}>${x}</option>`).join('')}</select>`;
      if (kind === 'mau')
        return `<label for="${id}">${nhan}</label><input id="${id}" type="color" value="${_t7Hex(val)}" oninput="${set}">`;
      if (kind === 'so')
        return `<label for="${id}">${nhan}</label><input id="${id}" type="number" value="${escapeHtml(String(val))}" oninput="${set}">`;
      return `<label for="${id}">${nhan}</label><input id="${id}" type="text" value="${escapeHtml(String(val == null ? '' : val))}" oninput="${set}">`;
    };
    const b = L.box || {}, st = L.style || {};
    const os = [
      L.type === 'text' ? o('text', 'Chữ', 'text', L.text) : '',
      o('x', 'Trái %', 'so', b.x), o('y', 'Trên %', 'so', b.y),
      o('w', 'Rộng %', 'so', b.w), o('h', 'Cao %', 'so', b.h),
      L.type === 'text' ? o('align', 'Canh', 'chon', b.align, ['left', 'center', 'right']) : '',
      L.type === 'text' ? o('size', 'Cỡ', 'so', st.size) : '',
      L.type === 'text' ? o('color', 'Màu chữ', 'mau', st.color) : o('fill', 'Màu khối', 'mau', st.fill),
      o('in', 'Kiểu vào', 'chon', L.in && L.in.preset, NOVA_IN_PRESETS),
      o('hold', 'Kiểu giữ', 'chon', L.hold && L.hold.preset, NOVA_HOLD_PRESETS),
    ].filter(Boolean).join('');
    return `<div class="edg"><b>Lớp ${j + 1} · ${L.type === 'text' ? 'chữ' : 'khối'}</b><div class="edf">${os}</div></div>`;
  }).join('');
}

// === L?: let _t7AiEditT2 ===
let _t7AiEditT2 = null;

// === L?: let _t7AiEditT ===
let _t7AiEditT = null;

// === L?: const _T7_SAFE ===
const _T7_SAFE = { x0: 4, x1: 96, y0: 5, y1: 95 };

// === L?: const _T7_SIZE ===
const _T7_SIZE = { min: 18, max: 220 };

// === L?: const _T7_MAX_LAYER ===
const _T7_MAX_LAYER = 3;

// === L?: const _t7Num ===
const _t7Num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

// === L?: const _t7Kep ===
const _t7Kep = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// === L?: const _t7MauOk ===
const _t7MauOk = (v) => (typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i.test(v.trim())) ? v.trim() : null;

// === L?: const _t7Preset ===
const _t7Preset = (v, ds, mac) => (ds.includes(String(v)) ? String(v) : mac);

// === L?: function _t7CustomSpec ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1069c, shared=967c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _t7CustomSpec(){ return `
✎ TỰ THIẾT KẾ (dùng RẤT THƯA):
Nếu cảnh này KHÔNG mẫu nào ở trên hợp mà vẫn đáng có đồ hoạ, thay "picks" bằng "custom":
"custom":[
 {"type":"shape","box":{"x":6,"y":62,"w":52,"h":22},"style":{"fill":"rgba(0,0,0,.6)","radius":12},
  "at":0,"in":{"preset":"wipeL","dur":0.4},"out":{"preset":"fade","dur":0.3}},
 {"type":"text","text":"chữ ngắn","box":{"x":9,"y":66,"w":46,"align":"left"},
  "style":{"size":64,"weight":800,"color":"#ffffff"},
  "at":0.15,"in":{"preset":"rise","dur":0.45},"hold":{"preset":"drift"},"out":{"preset":"fade","dur":0.3}}]
- Toạ độ theo % khung hình, gốc góc trên-trái. Tối đa 3 lớp, KHÔNG cho hai hộp đè nhau.
- type chỉ được "text" hoặc "shape". in/hold/out phải lấy đúng tên trong danh sách:
  vào: ${NOVA_IN_PRESETS.join(' ')}
  giữ: ${NOVA_HOLD_PRESETS.join(' ')}
  ra:  ${NOVA_OUT_PRESETS.join(' ')}
- Chỉ dùng khi thật sự cần bố cục riêng. Có mẫu hợp thì LUÔN dùng mẫu, đừng tự vẽ.`; }

// === L?: const _t7TrCam ===
const _t7TrCam = (cat, id) => {
  const e = (cat || []).find(x => x.id === id);
  return !!(e && (e.tags || []).includes('tranh'));
};

async function _t7AiTrans(clips, map, cat, onTick){
  const noi = clips.slice(0, -1);                    // clip cuối không có mối nối
  if (noi.length < 2) return [];
  const S = { quota: _t7AiTrQuota(noi.length), used: {}, last: {}, dung: 0, lienTiep: null,
              cho: new Set((cat || []).filter(x => x.id !== 'cut' && !(x.tags || []).includes('tranh')).map(x => x.id)) };
  const bang = (cat || []).filter(x => S.cho.has(x.id))
    .map(x => `${x.id} (${x.label}) — ${x.description}`).join('\n');
  const topic = String(state.videoLogline || '').trim();
  const ra = [];
  const CH = 40;

  for (let i = 0; i < noi.length; i += CH){
    if (state.cancelRequested) break;
    const lot = noi.slice(i, i + CH);
    const list = lot.map((c, k) => {
      const sc = _t7ClipScene(c), nx = _t7ClipScene(clips[i + k + 1]);
      const mp = map[c.sceneId] || {}, mn = map[clips[i + k + 1].sceneId] || {};
      return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s ${mp.role || '?'} → ${mn.role || '?'}] `
        + `"${_t7Gist(sc && sc.text, 70) || '—'}" ⇒ "${_t7Gist(nx && nx.text, 70) || '—'}"`;
    }).join('\n');

    const prompt = `Bạn là dựng phim tài liệu. Chọn CHUYỂN CẢNH cho từng mối nối dưới đây.
${topic ? 'CHỦ ĐỀ: ' + topic + '\n' : ''}
⚠️ LUẬT QUAN TRỌNG NHẤT: mặc định là CẮT THẲNG. Phim tài liệu tốt để khoảng 80% mối nối
là cắt thẳng; mọi cú chuyển khác đều là NGOẠI LỆ phải có lý do. Cả lô này bạn chỉ nên
đề cử tối đa ${Math.max(1, Math.round(lot.length * 0.2))} mối nối. Mối nối nào cắt thẳng thì BỎ HẲN khỏi kết quả.

CÚ CHUYỂN DÙNG ĐƯỢC:
${bang}

KHI NÀO DÙNG:
- Đổi chương, nhảy thời gian, đổi hẳn địa điểm → dip-black
- Chuyển ý trong cùng mạch, trôi thời gian ngắn → dissolve
- Đổi chủ đề dứt khoát, cần một cú hích → whip-pan
- Sang tư liệu cũ / hồi tưởng → grain-dissolve, defocus, light-leak, film-burn
- Cảnh cắt dán trên giấy nối nhau → paper-slide, paper-drop
- Bản đồ, biểu đồ, danh sách nối nhau → wipe-left, wipe-up, push-left, push-up
- Hai cảnh CÙNG BỐ CỤC → match-zoom
KHÔNG dùng cú mạnh ở giữa một đoạn đang kể liền mạch.

MỐI NỐI (số là chỉ số trong lô):
${list}

Trả JSON mảng, CHỈ những mối nối cần khác cắt thẳng:
[{"i":0,"tr":"dip-black","why":"lý do ngắn tiếng Việt dưới 16 từ"}]`;

    let arr = null;
    for (let thu = 0; thu < 2 && arr == null; thu++){
      try { arr = await callLLMJson(prompt, { maxTokens: 1200, validate: (d) => Array.isArray(d) }); }
      catch (e){ if (thu) novaLog && novaLog('⚡ Lô chuyển cảnh lỗi: ' + String(e.message || e).slice(0, 80), 'warn'); }
    }
    if (arr == null) continue;

    arr.forEach(row => {
      const k = Number(row && row.i);
      const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const idx = i + k;
      const id = String(row.tr || '').trim();
      if (_t7AiTrGate(id, idx, S, cat)) return;
      _t7AiTrTake(id, idx, S);
      const e = (cat || []).find(x => x.id === id) || {};
      ra.push({ kind: 'tr', sceneId: c.sceneId, clipId: c.id, name: _t7ClipLabel(c),
        tr: id, trLabel: e.label || id, trDur: Number(e.durationSec) || 0.5,
        line: _t7Gist(_t7ClipScene(c) && _t7ClipScene(c).text, 90) || '(không lời)',
        why: String(row.why || '').trim() || 'Trợ lý không nêu lý do.', state: '', picks: [], custom: [] });
    });
    if (onTick) onTick(Math.min(i + CH, noi.length), noi.length, ra.length);
  }
  return ra;
}

// === L?: let _t7Open ===
let _t7Open = null;

// === L?: let _t7SrcTab ===
let _t7SrcTab = {};

// === L?: const _t7SbCache ===
const _t7SbCache = {};

// === L?: let _t7SbTimer ===
let _t7SbTimer = null;

// === L?: const _t7YtId ===
const _t7YtId = (u) => { const m = String(u || '').match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/)([\w-]{11})/); return m ? m[1] : ''; };

// === L?: const _t7Notes ===
const _t7Notes = {};

// === L?: const _T7_TXT_KEYS ===
const _T7_TXT_KEYS = ['text', 'headline', 'title', 'value', 'caption', 'label', 'name'];

// === L?: const _T7_AMBIENT ===
const _T7_AMBIENT = [];

// === L?: const _T7_POS ===
const _T7_POS = ['top-left', 'top', 'top-right', 'center', 'bottom-left', 'bottom', 'bottom-right'];

// === L?: const _T7_NOTEXT ===
const _T7_NOTEXT = [];

// === L?: const _T7_CAM ===
const _T7_CAM = [];

// === L?: function _t7AiQuotaLine ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=729c, shared=684c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _t7AiQuotaLine(S){
  const q = S.quota, out = [];
  Object.keys(q).forEach(k => {
    if (k[0] === '_') return;
    const con = q[k] - (S.used[k] || 0);
    if (con <= 0) out.push(`${k}: HẾT, cấm dùng`);
  });
  const ambCon = q._ambient - S.amb, txtCon = q._text - S.txt;
  out.push(`lớp không khí còn ${Math.max(0, ambCon)} lượt`);
  out.push(`còn ${Math.max(0, txtCon)} cảnh được phép đặt chữ`);
  const kchu = _T7_NOTEXT.reduce((a2, k) => a2 + (S.used[k] || 0), 0);
  out.push(`đã dùng ${S.txt} mẫu CÓ CHỮ và ${kchu} mẫu KHÔNG CHỮ` +
    (S.txt >= 3 && kchu === 0 ? ' → ĐANG LỆCH HẲN VỀ CHỮ, lô này ưu tiên mẫu không chữ' : ''));
  return out.join(' · ');
}

async function _t7AiMap(clips, onTick){
  if (!state.aiMap) state.aiMap = {};
  const map = state.aiMap;                       // kho của DỰ ÁN, không phải biến tạm
  const CH = 70;                                 // 70 cảnh/lượt: gọn trong cửa sổ, vẫn thấy toàn cảnh
  const topic = String(state.videoLogline || '').trim();
  // Chỉ đọc cảnh CHƯA có trong bản đồ hoặc đã bị sửa lời. Mở lại video cũ → 0 lượt gọi.
  const can = clips.filter(c => {
    const sc = _t7ClipScene(c), h = _t7AiSig(sc && sc.text);
    const cu = map[c.sceneId];
    return !(cu && cu.h === h);
  });
  if (!can.length){ if (onTick) onTick(clips.length, clips.length, 0); return map; }
  clips = can;
  for (let i = 0; i < clips.length; i += CH){
    if (state.cancelRequested) break;
    const lot = clips.slice(i, i + CH);
    const list = lot.map((c, k) => `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s] ${_t7Gist(_t7ClipScene(c) && _t7ClipScene(c).text, 120) || '(không lời)'}`).join('\n');
    const prompt = `Bạn là biên tập video. Đọc CẢ đoạn kịch bản dưới đây rồi chấm từng cảnh.
${topic ? 'CHỦ ĐỀ CẢ VIDEO: ' + topic + '\n' : ''}
Với MỖI cảnh trả về:
- role: đúng một trong mo-dau | dan-dat | so-lieu | trich-dan | chuyen-y | chot
- key: tên người / tổ chức / địa danh cụ thể xuất hiện trong câu (không có thì "")
- num: con số đáng lên hình trong câu, giữ nguyên dạng đọc (không có thì "")
- emp: 0-3 — mức đáng nhấn bằng đồ hoạ. 0 = câu nối, 3 = câu chốt/gây sốc.
Cả video chỉ nên có vài cảnh emp=3. Đừng chấm rộng tay.

CẢNH:
${list}

Trả JSON mảng đủ ${lot.length} phần tử: [{"i":0,"role":"mo-dau","key":"","num":"","emp":2}]`;
    let arr = [];
    try { arr = await callLLMJson(prompt, { maxTokens: 2600, validate: (d) => Array.isArray(d) }); }
    catch (e){ novaLog && novaLog(`✨ Bản đồ cảnh ${i + 1}–${i + lot.length} lỗi: ${String(e.message || e).slice(0, 80)}`, 'warn'); }
    arr.forEach(r => {
      const k = Number(r && r.i); const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const sc = _t7ClipScene(c);
      map[c.sceneId] = { role: String(r.role || '').slice(0, 12), key: String(r.key || '').slice(0, 40),
        num: String(r.num || '').slice(0, 24), emp: Math.max(0, Math.min(3, Number(r.emp) || 0)),
        h: _t7AiSig(sc && sc.text) };
    });
    if (onTick) onTick(Math.min(i + CH, clips.length), clips.length, clips.length);
  }
  try { if (typeof saveState === 'function') saveState(true); } catch (e) {}   // bản đồ là thứ đắt nhất, lưu ngay
  return map;
}

async function _t7AiVision(cat, onTick){
  const jobs = [];
  _t7AiQ.forEach((q, i) => {
    if (q.kind === 'tr') return;
    const coChu = (q.custom && q.custom.length) ? q.custom.some(L => L.type === 'text')
                                                : q.picks.some(p => _t7TplTextKey(cat, p.template));
    if (coChu) jobs.push(i);
  });
  let done = 0, doi = 0;
  const one = async (qi) => {
    const q = _t7AiQ[qi]; if (!q || q.state) return;
    const clip = (t7State.clips || []).find(c => c.sceneId === q.sceneId);
    const img = clip ? _t7ThumbImg(clip) : null;
    if (!img){ doi++; return; }
    let b64 = '', mime = 'image/jpeg';
    try {
      const durl = await _t7ImgToDataUrl(img);
      const m = /^data:([^;,]+);base64,(.+)$/.exec(String(durl || ''));
      if (!m){ doi++; return; }
      mime = m[1]; b64 = m[2];
    } catch (e){ doi++; return; }
    // Mẫu tự sinh: chữ nằm ngay ở L.text, vị trí là hộp x/y nên không đổi theo "góc".
    const tuVe = !!(q.custom && q.custom.length);
    const pk = tuVe ? q.custom.find(L => L.type === 'text') : q.picks.find(p => _t7TplTextKey(cat, p.template));
    if (!pk){ doi++; return; }
    const tk = tuVe ? 'text' : _t7TplTextKey(cat, pk.template);
    const posKey = tuVe ? '' : _t7TplPosKey(cat, pk.template);
    const prompt = `Đây là KHUNG HÌNH thật của cảnh video. Ta định phủ lên nó dòng chữ: "${String(pk[tk] || '').slice(0, 60)}" (mẫu: ${tuVe ? 'tự thiết kế' : pk.template}).

Trả JSON: {"ok":true/false,"pos":"góc","text":"chữ sửa lại nếu cần","why":"1 câu ngắn tiếng Việt"}
- ok=false NẾU: khung hình đã có sẵn chữ/logo, hoặc quá rối, hoặc chủ thể chiếm gần hết khung nên chữ nào cũng che mặt.
- pos: chọn trong ${_T7_POS.join(' | ')} — vùng TRỐNG nhất, tránh mặt người và vật thể chính.
- text: giữ nguyên nếu ổn; rút ngắn dưới 6 từ nếu dài; "" nếu ok=false.
  Viết bằng ĐÚNG ${_t7AiLang()} — cùng ngôn ngữ với kịch bản, không dịch sang tiếng Việt.
Chỉ in JSON.`;
    let r = null;
    try {
      r = await callLLMJson(prompt, { maxTokens: 300, tries: 2,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text: prompt } ] }],
        validate: (d) => d && typeof d === 'object' && !Array.isArray(d) });
    } catch (e){ doi++; return; }
    if (!r) { doi++; return; }
    if (r.ok === false){
      q.drop = 'Khung hình không còn chỗ đặt chữ' + (r.why ? ' — ' + String(r.why).slice(0, 70) : '');
      return;
    }
    if (posKey && _T7_POS.includes(String(r.pos))) pk[posKey] = String(r.pos);
    const t2 = String(r.text || '').trim();
    if (t2 && t2 !== pk[tk]){ pk[tk] = t2.slice(0, 70); }
    q.why += ' · Đã soi khung: đặt ' + (posKey ? (pk[posKey] || 'mặc định') : 'vị trí mẫu') + '.';
  };
  // 4 luồng song song — nhanh gấp mấy lần chạy tuần tự mà không dội request.
  const pool = 4; let cur = 0;
  await Promise.all(Array.from({ length: Math.min(pool, jobs.length) }, async () => {
    while (cur < jobs.length && !state.cancelRequested){
      const qi = jobs[cur++];
      await one(qi);
      done++; if (onTick) onTick(done, jobs.length);
    }
  }));
  return { xong: done, doi };
}

async function _t7AiCritic(cat){
  const live = _t7AiQ.map((q, i) => ({ q, i })).filter(x => !x.q.drop && x.q.kind !== 'tr');
  if (live.length < 4) return 0;
  const list = live.map((x, k) => {
    if (x.q.custom && x.q.custom.length){
      const t = (x.q.custom.find(L => L.type === 'text') || {}).text || '';
      return `${k}. ${x.q.name} · tự thiết kế (${x.q.custom.length} lớp) · "${String(t).slice(0, 40)}"`;
    }
    const tk = _t7TplTextKey(cat, x.q.picks[0].template);
    return `${k}. ${x.q.name} · ${x.q.picks.map(p => p.template).join('+')} · "${String((tk && x.q.picks[0][tk]) || '').slice(0, 40)}"`;
  }).join('\n');
  const prompt = `Đây là TOÀN BỘ kế hoạch đồ hoạ của một video. Soi lại như một biên tập khó tính.

Chỉ ra những mục NÊN BỎ vì: trùng ý với mục liền kề, chữ lặp lại, đặt chữ vào cảnh không đáng, hoặc cả cụm dày quá làm video rối.
Đừng bỏ quá 20% số mục. Kế hoạch đã ổn thì trả mảng rỗng.

KẾ HOẠCH:
${list}

Trả JSON: [{"k":3,"why":"lý do ngắn tiếng Việt dưới 15 từ"}]`;
  let arr = [];
  try { arr = await callLLMJson(prompt, { maxTokens: 900, validate: (d) => Array.isArray(d) }); }
  catch (e){ return 0; }
  let n = 0;
  const tran = Math.ceil(live.length * 0.2);
  arr.slice(0, tran).forEach(r => {
    const k = Number(r && r.k); const x = live[Number.isFinite(k) ? k : -1]; if (!x) return;
    x.q.drop = 'Tự kiểm loại: ' + (String(r.why || '').slice(0, 70) || 'trùng ý với cảnh bên cạnh'); n++;
  });
  return n;
}

async function t7AiPropose(lamLai){
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  if (!clips.length){ setStatus7('Chưa có cảnh nào.', 'error'); return; }
  if (!window.native || typeof window.native.sceneTemplates !== 'function'){
    setStatus7('Chỉ chạy trong app Nova.', 'error'); return; }
  const cat = await _t7Catalog();
  if (!cat){ setStatus7('Không đọc được danh mục mẫu — khởi động lại app.', 'error'); return; }
  // Kho mẫu rỗng thì BỎ QUA phần đồ hoạ chứ không thoát hẳn — chuyển cảnh vẫn chạy được.
  // Chạy phần đề xuất mẫu khi kho rỗng chỉ tổ đốt 60 lượt gọi rồi loại sạch.
  const boQuaDoHoa = !cat.length;
  const allowed = new Map(cat.map(c => [c.template, c]));

  const m = document.getElementById('t7Ai'); if (m) m.classList.add('on');

  // ── Mở lại video cũ: dựng thẳng hàng đề xuất đã lưu, KHÔNG gọi lại AI ──
  if (!lamLai){
    const co = new Set(clips.map(c => c.sceneId));
    const cu = (state.aiQueue || []).filter(q => q && q.sceneId && co.has(q.sceneId));   // bỏ cảnh đã xoá
    if (cu.length){
      _t7AiQ = cu; state.aiQueue = cu;
      const cho = cu.filter(q => !q.state).length;
      const nMap = Object.keys(state.aiMap || {}).length;
      const nTrCu = cu.filter(q => q.kind === 'tr').length;
      _t7AiSteps(6, { 0: clips.length + ' cảnh', 1: nMap + ' cảnh đã có vai trò',
        2: (cu.length - nTrCu) + ' đồ hoạ (kết quả đã lưu)', 3: 'đã soi lần trước', 4: 'đã kiểm lần trước',
        5: nTrCu + ' chuyển cảnh' });
      _t7AiRender();
      setStatus7(cho ? `✨ ${cho}/${cu.length} đề xuất còn chờ duyệt (lấy từ dự án, không chạy lại AI).`
                     : `✓ Đã duyệt hết ${cu.length} đề xuất của video này. Bấm ↻ Phân tích lại nếu muốn làm mới.`, 'ok');
      return;
    }
  }
  _t7AiQ = []; state.aiQueue = _t7AiQ;
  clearCancel && clearCancel();
  const nWord = clips.reduce((n, c) => {
    const sc = _t7ClipScene(c); return n + String((sc && sc.text) || '').trim().split(/\s+/).filter(Boolean).length; }, 0);
  _t7AiSteps(0, { 0: clips.length + ' cảnh · ' + nWord.toLocaleString('vi-VN') + ' chữ' });
  document.getElementById('t7AiProps').innerHTML = '<div class="t7-empty">Đang đọc kịch bản…</div>';

  // Chỉ xét cảnh CHƯA có lớp nào — khỏi đề xuất chồng lên cảnh đã dựng.
  const todo = clips.filter(c => {
    const sp = (state.sceneSpecs || {})[c.sceneId];
    return !(sp && (sp.layers || []).some(L => L && L.type !== 'backdrop'));
  });
  if (!todo.length){ _t7AiSteps(5, {}); _t7AiRender(); return; }

  // ── 2. Bản đồ vai trò ───────────────────────────────────────────────
  _t7AiSteps(1, { 1: 'đang đọc cả video…' });
  setStatus7('✨ Trợ lý đọc toàn bộ kịch bản để nắm mạch…', 'working');
  const map = await _t7AiMap(todo, (d, t) => _t7AiSteps(1, { 1: d + '/' + t + ' cảnh' }));
  const nRole = Object.keys(map).length;
  const dem = {}; Object.values(map).forEach(v => { dem[v.role] = (dem[v.role] || 0) + 1; });
  const roleLine = Object.entries(dem).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + v).join(' · ');
  if (state.cancelRequested){ _t7AiSteps(1, { 1: 'đã dừng' }); _t7AiRender(); return; }

  // ── 3. Đề xuất theo lô, hạn ngạch giữ bằng code ─────────────────────
  const topic = String(state.videoLogline || '').trim();
  const catLine = cat.map(c => `${c.template} (${c.label}) — điền: ${c.params.join(', ')}`).join('\n');
  const S = { quota: _t7AiQuota(todo.length), used: {}, last: {}, amb: 0, txt: 0 };
  const hong = [];                                  // lô lỗi → báo tên cảnh, không nuốt câm
  const BATCH = 10;
  for (let i = 0; boQuaDoHoa ? false : i < todo.length; i += BATCH){
    if (state.cancelRequested) break;
    const lot = todo.slice(i, i + BATCH);
    _t7AiSteps(2, { 1: nRole + ' cảnh · ' + roleLine, 2: Math.min(i + BATCH, todo.length) + '/' + todo.length + ' cảnh · ' + _t7AiQ.length + ' đề xuất' });
    setStatus7(`✨ Trợ lý đọc cảnh ${i + 1}–${Math.min(i + BATCH, todo.length)}/${todo.length}…`, 'working');
    const list = lot.map((c, k) => {
      const sc = _t7ClipScene(c), mp = map[c.sceneId] || {};
      const meta = [mp.role, mp.emp != null ? 'nhấn ' + mp.emp : '', mp.key ? 'tên: ' + mp.key : '', mp.num ? 'số: ' + mp.num : ''].filter(Boolean).join(' · ');
      return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s]${meta ? ' {' + meta + '}' : ''} ${_t7Gist(sc && sc.text, 200) || '(không có lời)'}`;
    }).join('\n');

    const prompt = `Bạn là biên tập đồ hoạ chuyển động cho video faceless tiếng Việt.
${topic ? 'CHỦ ĐỀ CẢ VIDEO: ' + topic + '\n' : ''}Với MỖI cảnh dưới đây, chọn 0–2 mẫu đồ hoạ phủ lên hình, VÀ giải thích vì sao.

MẪU DÙNG ĐƯỢC (chỉ được chọn trong danh sách này):
${catLine}

HẠN NGẠCH CÒN LẠI CỦA CẢ VIDEO (vượt là bị loại tự động):
${_t7AiQuotaLine(S)}

🌐 NGÔN NGỮ CHỮ LÊN HÌNH — QUAN TRỌNG NHẤT:
Kịch bản viết bằng ${_t7AiLang()}. MỌI chữ hiển thị trên màn hình phải viết bằng ĐÚNG ${_t7AiLang()}:
text, subtitle, headline, title, value, unit, kicker, note, caption, label, name, body, dek, stamp.
Người xem thấy chữ khác ngôn ngữ với giọng đọc là hỏng cả video.
CHỈ RIÊNG trường "why" viết bằng tiếng Việt — đó là lời giải thích cho người dựng, không lên hình.

LUẬT:
- MẶC ĐỊNH LÀ KHÔNG GẮN GÌ. Chỉ đề xuất khi cảnh THẬT SỰ khá lên nhờ nó.
  Cả video chỉ nên có khoảng 1/8 số cảnh mang chữ. Bỏ trống là lựa chọn đúng, không phải lười.
- Mỗi cảnh tối đa 1 mẫu. Hai mẫu một cảnh chỉ khi một cái là lớp không khí không chữ.
- Ưu tiên cảnh có {nhấn 2} hoặc {nhấn 3}. Cảnh {nhấn 0} thì hầu như luôn bỏ trống.
- Cảnh {so-lieu} có sẵn "số:" → ưu tiên mẫu trình bày số liệu, điền ĐÚNG con số đó.
- Cảnh có "tên:" mới được dùng mẫu gắn tên/nhãn, điền đúng tên đó.
- Chữ hiện trên màn hình phải NGẮN (dưới 6 từ), là ý chốt — KHÔNG chép nguyên lời thoại.
- Cảnh dưới 2.5 giây thì đừng gắn mẫu có chữ dài.

⚠️ ƯU TIÊN MẪU KHÔNG CHỮ nếu kho có. Video mà cảnh nào cũng đắp chữ thì rẻ tiền và
mệt mắt — người xem đã nghe giọng đọc rồi, không cần đọc lại chính câu đó trên màn hình.
Cảnh {nhấn 0} hoặc {nhấn 1} mà vẫn muốn có gì đó → chọn mẫu KHÔNG chữ, đừng nhét chữ.

${_t7CustomSpec()}


LÝ DO ("why") phải bám vào CHÍNH câu thoại và độ dài cảnh, viết tiếng Việt, 1 câu dưới 22 từ.
Ví dụ đúng: "Câu có con số gây bất ngờ nên phóng chữ rồi nảy, khớp nhịp nhấn."
Ví dụ SAI (chung chung, cấm): "Mẫu này đẹp và phù hợp với cảnh."

CẢNH:
${list}

Trả JSON mảng, mỗi phần tử ứng với MỘT cảnh có đề xuất (cảnh không cần gì thì bỏ hẳn):
[{"i":0,"why":"lý do ngắn","picks":[{"template":"tên-mẫu","text":"chữ ngắn nếu mẫu cần"}]}]
Chỉ điền các trường mà mẫu đó nhận. Không thêm trường lạ.
Cảnh tự thiết kế thì bỏ "picks", dùng "custom" theo đúng khuôn ở trên.`;

    let arr = null;
    for (let thu = 0; thu < 2 && arr == null; thu++){
      try { arr = await callLLMJson(prompt, { maxTokens: 1500, validate: (d) => Array.isArray(d) }); }
      catch (e){ if (thu) novaLog && novaLog(`✨ Lô ${i / BATCH + 1} lỗi: ${String(e.message || e).slice(0, 90)}`, 'warn'); }
    }
    if (arr == null){ lot.forEach(c => hong.push(_t7ClipLabel(c))); continue; }

    arr.forEach(row => {
      const k = Number(row && row.i);
      const c = lot[Number.isFinite(k) ? k : -1]; if (!c) return;
      const idx = i + (Number.isFinite(k) ? k : 0);
      const dur = parseFloat(_t7ClipDur(c)) || 3;
      // AI bịa tên mẫu thì bỏ — engine không phải đoán. Rồi soi tiếp qua hạn ngạch.
      const picks = [];
      (Array.isArray(row.picks) ? row.picks : []).slice(0, 2).forEach(x => {
        if (!x || !allowed.has(x.template)) return;
        if (dur < 2.5 && _t7TplTextKey(cat, x.template)) return;   // cảnh chớp mắt, chữ chưa kịp đọc
        if (_t7AiGate(x.template, idx, S, cat)) return;
        _t7AiTake(x.template, idx, S, cat);
        picks.push(x);
      });
      // Không có mẫu nào hợp → AI tự bố cục. Lọc + kẹp mọi con số trước khi nhận.
      const custom = picks.length ? [] : _t7AiFixLayers(row.custom, dur);
      if (!picks.length && !custom.length) return;
      if (custom.length){
        if (custom.some(L => L.type === 'text') && S.txt >= S.quota._text) return;   // vẫn tính vào trần chữ
        if (custom.some(L => L.type === 'text')) S.txt++;
      }
      const sc = _t7ClipScene(c), mp = map[c.sceneId] || {};
      _t7AiQ.push({
        sceneId: c.sceneId, fx: c.fx, name: _t7ClipLabel(c), picks, custom, role: mp.role || '',
        tplLabel: custom.length ? _t7CustomNhan(custom)
          : picks.map(x => (allowed.get(x.template) || {}).label || x.template).join(' + '),
        line: _t7Gist(sc && sc.text, 110) || '(không có lời)',
        why: String(row.why || '').trim() || 'Trợ lý không nêu lý do — nên xem kỹ trước khi gắn.',
        state: '', drop: '',
      });
    });
    _t7AiRender();
  }

  // ── 4. Soi khung hình những cảnh định đặt chữ ───────────────────────
  let vis = { xong: 0, doi: 0 };
  const nTxt = _t7AiQ.filter(q => q.picks.some(p => _t7TplTextKey(cat, p.template))).length;
  if (nTxt && !boQuaDoHoa && !state.cancelRequested){
    _t7AiSteps(3, { 3: '0/' + nTxt + ' khung hình' });
    setStatus7(`👁 Soi ${nTxt} khung hình để đặt chữ vào chỗ trống…`, 'working');
    vis = await _t7AiVision(cat, (d, t) => _t7AiSteps(3, { 3: d + '/' + t + ' khung hình' }));
    _t7AiRender();
  }

  // ── 5. Tự kiểm ──────────────────────────────────────────────────────
  let nBo = 0;
  if (!boQuaDoHoa && !state.cancelRequested){
    _t7AiSteps(4, { 4: 'đang soi lại cả kế hoạch…' });
    setStatus7('🧐 Tự kiểm cả kế hoạch…', 'working');
    nBo = await _t7AiCritic(cat);
  }
  const nDrop = _t7AiQ.filter(q => q.drop).length;
  _t7AiQ = _t7AiQ.filter(q => !q.drop);

  // ── 6. Chuyển cảnh ──────────────────────────────────────────────────
  let nTr = 0;
  if (!state.cancelRequested){
    try { if (!_t7Trans) await _t7LoadTrans(); } catch (e) {}
    const trCat = _t7Trans || [];
    if (trCat.length > 1){
      _t7AiSteps(5, { 5: '0/' + Math.max(0, clips.length - 1) + ' mối nối' });
      setStatus7('⚡ Chọn chuyển cảnh cho ' + Math.max(0, clips.length - 1) + ' mối nối…', 'working');
      const tr = await _t7AiTrans(clips, map, trCat,
        (d, t, n) => _t7AiSteps(5, { 5: d + '/' + t + ' mối nối · ' + n + ' đề xuất' }));
      _t7AiQ = _t7AiQ.concat(tr); nTr = tr.length;
    } else {
      _t7AiSteps(5, { 5: 'kho chuyển cảnh rỗng — bỏ qua' });
    }
  }
  _t7AiSave();                                   // chốt kết quả vào dự án ngay khi chạy xong

  _t7AiSteps(6, {
    1: nRole + ' cảnh · ' + roleLine,
    2: boQuaDoHoa ? 'kho mẫu rỗng — bỏ qua' : (todo.length + ' cảnh đã đọc'),
    3: boQuaDoHoa ? 'bỏ qua' : (nTxt ? (vis.xong + '/' + nTxt + ' khung' + (vis.doi ? ' · ' + vis.doi + ' cảnh chưa có hình' : '')) : 'không cảnh nào đặt chữ'),
    4: boQuaDoHoa ? 'bỏ qua' : (nDrop ? ('loại ' + nDrop + ' đề xuất yếu') : 'kế hoạch sạch'),
    5: nTr ? (nTr + '/' + Math.max(1, clips.length - 1) + ' mối nối khác cắt thẳng') : 'tất cả cắt thẳng',
  });
  _t7AiRender();
  if (hong.length) novaLog && novaLog(`✨ ${hong.length} cảnh không đề xuất được (lô lỗi): ${hong.slice(0, 6).join(', ')}${hong.length > 6 ? '…' : ''}`, 'warn');
  const nGfx = _t7AiQ.length - nTr;
  if (boQuaDoHoa && !nTr){
    setStatus7('Kho mẫu và kho chuyển cảnh đều rỗng — thêm vào editor-pro/nova-remotion/src/ rồi chạy lại.', 'info');
    _t7AiRender(); return;
  }
  setStatus7(_t7AiQ.length
    ? `✨ ${nGfx} đồ hoạ + ${nTr} chuyển cảnh${nDrop ? ` (đã tự loại ${nDrop})` : ''}${hong.length ? ` · ${hong.length} cảnh lỗi, xem Nhật ký` : ''} — duyệt ở bảng bên phải.`
    : 'Trợ lý không đề xuất gì thêm.', _t7AiQ.length ? 'ok' : 'info');
}

async function t7AiDesign(){
  const clips = (typeof _t7Clips === 'function') ? _t7Clips() : [];
  if (!clips.length){ setStatus7('Chưa có cảnh nào.', 'error'); return; }
  if (!window.native || typeof window.native.sceneTemplates !== 'function'){
    setStatus7('Chỉ chạy trong app Nova (khởi động lại app sau khi cập nhật).', 'error'); return;
  }
  const cat = await _t7Catalog();
  if (!cat){ setStatus7('Không đọc được danh mục mẫu — khởi động lại app.', 'error'); return; }
  const allowed = new Set(cat.map(c => c.template));

  // Khoá ĐÚNG nút của chính hàm này (trước khoá nhầm t7AiDesignBtn = nút "Trợ lý dựng"),
  // đồng thời chặn bấm lần hai gây chạy chồng 2 vòng lặp trên cùng danh sách cảnh.
  if (_t7AiGfxRunning){ if (typeof requestCancel === 'function') requestCancel();
    setStatus7('⏸ Sẽ dừng sau khi xong lô đang chạy…', 'info'); return; }
  _t7AiGfxRunning = true;
  const btn = document.getElementById('t7AiGfxBtn');
  if (btn){ btn.textContent = '■ Dừng dựng'; btn.style.color = 'var(--red)'; btn.style.borderColor = 'var(--red)'; }
  const catLine = cat.map(c => `${c.template} (${c.label}) — điền: ${c.params.join(', ')}`).join('\n');
  const specs = Object.assign({}, state.sceneSpecs || {});
  let done = 0, picked = 0;
  const BATCH = 12;                                   // lô nhỏ để JSON không vỡ ở kịch bản dài

  try {
    for (let i = 0; i < clips.length; i += BATCH){
      if (state.cancelRequested){ setStatus7('Đã dừng.', 'warn'); break; }
      const lot = clips.slice(i, i + BATCH);
      setStatus7(`🎬 AI dựng đồ hoạ ${i + 1}–${Math.min(i + BATCH, clips.length)}/${clips.length}…`, 'working');
      const list = lot.map((c, k) => {
        const sc = (typeof _t7ClipScene === 'function') ? _t7ClipScene(c) : null;
        return `${k}. [${(parseFloat(_t7ClipDur(c)) || 3).toFixed(1)}s] ${_t7Gist(sc && sc.text, 180) || '(không có lời)'}`;
      }).join('\n');

      const prompt = `Bạn là biên tập đồ hoạ chuyển động cho video faceless tiếng Việt.
Với MỖI cảnh dưới đây, chọn 0–2 mẫu đồ hoạ phủ lên hình. Được phép để trống (mảng rỗng) nếu cảnh không cần gì.

MẪU DÙNG ĐƯỢC (chỉ được chọn trong danh sách này):
${catLine}

LUẬT:
- Đừng lạm dụng: phần lớn cảnh chỉ cần 0 hoặc 1 mẫu. Chữ đè lên mọi cảnh sẽ rối và che mất hình.
- Chữ hiện trên màn hình phải NGẮN (dưới 6 từ), là ý chốt của cảnh — KHÔNG chép nguyên lời thoại.
- lower-thirds chỉ dùng khi cảnh nhắc tên người/địa danh cụ thể.
- typewriter-text / kinetic-typography chỉ cho cảnh nhấn mạnh, tối đa 1-2 cảnh trong cả video.
- vignette / film-grain / light-leak là lớp không khí, dùng thưa và không kèm chữ.
- Cảnh ngắn dưới 2.5 giây thì đừng gắn mẫu có chữ dài.

CẢNH:
${list}

Trả JSON mảng ${lot.length} phần tử, phần tử thứ k ứng với cảnh k:
[{"i":0,"picks":[{"template":"tên-mẫu","text":"chữ ngắn nếu mẫu cần"}]}]
Chỉ điền các trường mà mẫu đó nhận. Không thêm trường lạ.`;

      let arr = [];
      try {
        arr = await callLLMJson(prompt, { maxTokens: 1400, validate: (d) => Array.isArray(d) });
      } catch (e) {
        novaLog && novaLog(`🎬 Lô ${i / BATCH + 1} lỗi: ${String(e.message || e).slice(0, 90)}`, 'warn');
        done += lot.length; continue;                 // hỏng 1 lô thì bỏ qua, không chết cả lượt
      }

      arr.forEach((row) => {
        const k = Number(row && row.i);
        const c = lot[Number.isFinite(k) ? k : -1];
        if (!c) return;
        const picks = Array.isArray(row.picks) ? row.picks.slice(0, 2) : [];
        // Chỉ nhận mẫu có thật — AI bịa tên thì bỏ, không để engine phải đoán.
        const layers = picks
          .filter(p => p && allowed.has(p.template))
          .map(p => Object.assign({}, p));
        if (!layers.length){ delete specs[c.sceneId]; return; }
        specs[c.sceneId] = {
          rev: Date.now(),
          // Ảnh cảnh luôn nằm dưới cùng; '@scene' được _t7NovaScenes thay bằng ảnh thật lúc dựng.
          layers: [{ type: 'backdrop', src: '@scene', at: 0, in: { preset: 'fade', dur: 0.4 }, hold: { preset: _T7_HOLD[c.fx] || 'kenIn', amp: 1 }, out: { preset: 'fade', dur: 0.35 } }].concat(layers),
        };
        picked += layers.length;
      });
      done += lot.length;
    }

    state.sceneSpecs = specs;
    const nScene = Object.keys(specs).length;
    if (typeof saveState === 'function') saveState(true);
    setStatus7(`✓ AI đã gắn ${picked} lớp đồ hoạ cho ${nScene}/${clips.length} cảnh.`, 'ok');
    if (typeof novaLog === 'function') novaLog(`🎬 AI dựng đồ hoạ: ${picked} lớp / ${nScene} cảnh.`, 'ok');
    if (typeof t7RenderTimeline === 'function') try { t7RenderTimeline(); } catch (e) {}
  } finally {
    _t7AiGfxRunning = false;
    if (btn){ btn.disabled = false; btn.textContent = '🎬 AI dựng đồ hoạ'; btn.style.color = ''; btn.style.borderColor = ''; }
    if (typeof clearCancel === 'function') clearCancel();
  }
}

// === L?: const _t7RmState ===
const _t7RmState = { on:false, frame:-1, attempt:0, ready:false, busy:false, sig:'' };

async function t7NovaExport(){
  if (!window.native || typeof window.native.renderNovaScenes !== 'function'){ setStatus7('Chỉ chạy trong app Nova (khởi động lại app sau khi cập nhật).', 'error'); return; }
  if (!_t7Clips().length){ setStatus7('Chưa có cảnh.', 'error'); return; }
  setStatus7('◈ Gom cảnh + ảnh cho Nova Scene…', 'working');
  const scenes = await _t7NovaScenes({ inline: true });
  const totalSec = scenes.reduce((s, x) => s + (Number(x.durationSec) || 3), 0);
  setStatus7('◈ Đang render ' + scenes.length + ' cảnh (~' + Math.round(totalSec) + 's)…', 'working');
  try {
    if (typeof window.native.onRemotionProgress2 === 'function') window.native.onRemotionProgress2(s => { if (s && s.percent != null) setStatus7('◈ Nova Scene ' + s.percent + '% ' + (s.message || ''), 'working'); });
    // Nova Scene chỉ dựng HÌNH — gửi kèm tiếng để main ghép vào sau khi render, không thì video câm.
    let voiceB64 = null, musicB64 = null;
    if (t7State.audioFile){ try { voiceB64 = await _t7FileToDataUrl(t7State.audioFile); } catch (e) {} }
    if (t7State.bgmFile){ try { musicB64 = await _t7FileToDataUrl(t7State.bgmFile); } catch (e) {} }
    const musicVolume = (parseInt(document.getElementById('t7Bgmvol')?.value) || 22) / 100;
    const r = await window.native.renderNovaScenes({ scenes, globals: _t7Globs(), voiceB64, musicB64, musicVolume });
    if (r && r.ok) setStatus7('✓ Xuất xong: ' + (r.outputPath || '') + ' · ' + r.durationInFrames + ' khung @' + r.fps + 'fps.', 'ok');
    else setStatus7('Lỗi xuất Nova Scene: ' + ((r && r.error) || 'không rõ'), 'error');
  } catch (e){ setStatus7('Lỗi xuất Nova Scene: ' + String(e).slice(0, 150), 'error'); }
}

// === L?: const NOVA_IN_PRESETS ===
const NOVA_IN_PRESETS   = ['none','fade','slideL','slideR','rise','drop','pop','deal','wipeL','defocus','zoom'];

// === L?: const NOVA_OUT_PRESETS ===
const NOVA_OUT_PRESETS  = ['none','fade','sinkL','sinkR','fall','shrink','wipeR'];

// === L?: const NOVA_HOLD_PRESETS ===
const NOVA_HOLD_PRESETS = ['none','kenIn','kenOut','panL','panR','panU','panD','growX','growY','drift','breathe'];

// === L?: let _t7AiGfxRunning ===
let _t7AiGfxRunning = false;

// === L?: const _T7_SLIDESHOW_FX ===
const _T7_SLIDESHOW_FX = { 'zoom-in':'slowZoomIn','zoom-out':'slowZoomOut','pan-left':'panLeft','pan-right':'panRight','pan-up':'panUp','pan-down':'panDown','none':'breathe' };

// === L?: let _t7BatchRunning ===
let _t7BatchRunning = false;

async function t7TranslateAll(){
  const clips = _t7Clips();
  const seen = new Set(), items = [];
  for (const c of clips){ const id = c.sceneId; if (!id || seen.has(id)) continue; seen.add(id); const t = (_t7ClipText(c) || '').trim(); if (t) items.push({ id, t }); }
  if (!items.length) return setStatus7('Không có lời thoại để dịch.', 'info');
  if (!state.sceneTrans) state.sceneTrans = {};
  const btn = document.getElementById('t7TransBtn'); if (btn) btn.disabled = true;
  setStatus7('🌐 Đang dịch ' + items.length + ' câu sang tiếng Việt…', 'working');
  const BATCH = 20; let done = 0, ok = 0;
  try {
    for (let i = 0; i < items.length; i += BATCH){
      const chunk = items.slice(i, i + BATCH);
      // Trả MẢNG theo ĐÚNG THỨ TỰ (không dùng id-key vì model hay bỏ số 0 đầu "016"→"16" gây lệch).
      const prompt = `Dịch ${chunk.length} câu lời thoại sau sang TIẾNG VIỆT tự nhiên, sát nghĩa, giữ giọng kể.\nTrả về CHÍNH XÁC 1 JSON ARRAY gồm ĐÚNG ${chunk.length} bản dịch, THEO ĐÚNG THỨ TỰ, KHÔNG kèm số/nhãn, KHÔNG markdown, KHÔNG chữ nào ngoài JSON:\n["bản dịch câu 1","bản dịch câu 2", …]\n\nCÁC CÂU:\n` + chunk.map((x, k) => `${k + 1}. ${x.t}`).join('\n');
      try {
        const arr = await callLLMJson(prompt, { maxTokens: 3500, validate: d => Array.isArray(d) });
        chunk.forEach((x, k) => { const v = arr && arr[k]; if (v){ state.sceneTrans[x.id] = String(v).trim(); ok++; } });
      } catch (e){ /* bỏ qua lô lỗi */ }
      done += chunk.length; setStatus7('🌐 Dịch… ' + Math.min(done, items.length) + '/' + items.length, 'working');
    }
    try { syncStateToCurrentProfile(); saveState(true); } catch (e) {}
    t7RenderPreview();
    setStatus7('✓ Đã dịch ' + ok + '/' + items.length + ' câu sang tiếng Việt. Tua bản xem trước để kiểm tra.', 'ok');
  } finally { if (btn) btn.disabled = false; }
}

// === L?: let _t7OvBusy, _t7OvKey ===
let _t7OvBusy = false, _t7OvKey = '';

// === L?: let _t7GlobKey ===
let _t7GlobKey = '';

// === L?: const _t7Kebab ===
const _t7Kebab = (k) => k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());

// === L?: function _t7FileUrl ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=408c, shared=271c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _t7FileUrl(src){
  const s = String(src || '');
  if (!s || /^(https?:|data:|blob:|file:|assets\/)/i.test(s)) return s;
  if (/^[a-zA-Z]:[\\/]/.test(s)) return 'file:///' + s.replace(/\\/g, '/');
  if (s.startsWith('/')) return 'file://' + s;
  return s;
}

// === L?: function _t7LayerHtml ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1804c, shared=1457c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _t7LayerHtml(L){
  const w = Object.entries(L.wrap).filter(([,v]) => v !== '' && v != null).map(([k,v]) => _t7Kebab(k) + ':' + v).join(';');
  const cs = L.css ? Object.entries(L.css).filter(([,v]) => v !== '' && v != null).map(([k,v]) => _t7Kebab(k) + ':' + v).join(';') : '';
  if (L.kind === 'text'){
    const inner = L.chars
      ? L.chars.map(ch => `<span style="display:inline-block;white-space:pre;opacity:${ch.opacity};transform:${ch.transform}">${escapeHtml(ch.ch === ' ' ? '\u00a0' : ch.ch)}</span>`).join('')
      : escapeHtml(L.text);
    return `<div style="${w}"><div style="${cs};text-align:${L.align}">${inner}</div></div>`;
  }
  if (L.kind === 'shape') return `<div style="${w}"><div style="${cs}"></div></div>`;
  if (L.kind === 'media' && L.src){
    // Video: tua tới đúng giây bằng mảnh #t= để khung xem trước khớp playhead.
    if (L.isVideo) return `<div style="${w}"><video src="${_t7FileUrl(L.src)}${/#/.test(L.src)?'':'#t='+(L.vt||0).toFixed(2)}" style="${cs}" muted playsinline preload="metadata"></video></div>`;
    return `<div style="${w}"><img src="${_t7FileUrl(L.src)}" style="${cs}"></div>`;
  }
  if (L.kind === 'bit') return `<div style="${w}"><div style="width:100%;height:100%;border:0.3cqh dashed rgba(255,255,255,.5);border-radius:1cqh;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);font-size:2cqh">✨ ${escapeHtml(L.name)}</div></div>`;
  return '';
}

// === L?: let _t7ThumbObs ===
let _t7ThumbObs = [];

// === L?: let _t7SfxCache ===
let _t7SfxCache = null;

// === L?: let _t7SfxAudio ===
let _t7SfxAudio = null;

async function t7SfxLibAdd(id){
  const x = (_t7SfxCache || []).find(i => i.id === id); if (!x) return;
  try {
    const b = await window.native.readFileB64(x.path);
    if (!b || !b.dataUrl){ setStatus7('Không đọc được hiệu ứng.', 'error'); return; }
    if (!Array.isArray(t7State.sfx)) t7State.sfx = [];
    t7State.sfx.push({ id: _t7NewId(), name: x.name, dataUrl: b.dataUrl, start: +(t7State.playT || 0).toFixed(2), volume: 0.9 });
    if (typeof _t7PersistClips === 'function') _t7PersistClips();
    t7RenderTimeline();
    setStatus7('🔊 Đã thêm "' + x.name + '" tại ' + (t7State.playT || 0).toFixed(1) + 's.', 'ok');
  } catch (e){ setStatus7('Lỗi thêm SFX: ' + String(e).slice(0, 80), 'error'); }
}

// === L?: let _t7TlRaf ===
let _t7TlRaf = 0;

// === L?: const _T7_RATES ===
const _T7_RATES = [0.5, 1, 1.5, 2];

// === L?: function t7CycleRate ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-t7.js (peer=130c, shared=356c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function t7CycleRate(){
  const i = _T7_RATES.indexOf(t7State.rate || 1);
  t7State.rate = _T7_RATES[(i + 1) % _T7_RATES.length];
  const b = document.getElementById('t7Rate'); if (b) b.textContent = t7State.rate + 'x';
  // Đang phát thì khởi động lại vòng phát để mốc thời gian tính theo tốc độ mới.
  if (t7State.playing){ t7Pause(); t7Play(); }
}

// === L?: let _t7AutoWired ===
let _t7AutoWired = false;

// === L?: let _t7Gpu ===
let _t7Gpu = null;

// === L?: const T7_SUBSTYLES ===
const T7_SUBSTYLES = {
  vien:    { name: 'Viền (karaoke)', prev: 'color:#fff;text-shadow:0 0 3px #000,2px 2px 3px #000,-2px -2px 3px #000' },
  nova:    { name: 'Nền đen',        prev: 'color:#fff;background:rgba(0,0,0,.72);padding:2px 10px;border-radius:5px' },
  cam:     { name: 'Khối cam',       prev: 'color:#fff;background:rgba(194,65,12,.85);padding:2px 10px;border-radius:5px' },
  vang:    { name: 'Vàng đậm',       prev: 'color:#ffe000;text-shadow:0 0 3px #000,2px 2px 4px #000,-1px -1px 3px #000' },
  toigian: { name: 'Tối giản',       prev: 'color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.9)' },
};

// === L?: function t7RenderSubStyleChips ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở tool-t7.js (peer=968c, shared=757c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function t7RenderSubStyleChips(){
  const box = document.getElementById('t7SubStyleChips'); if (!box) return;
  const cur = state.t7SubStyle || 'vien';
  box.innerHTML = Object.entries(T7_SUBSTYLES).map(([k, v]) =>
    `<button type="button" onclick="t7PickSubStyle('${k}')" style="border:1px solid ${k===cur?'var(--accent)':'var(--border)'};background:${k===cur?'color-mix(in srgb,var(--accent) 15%,transparent)':'var(--surface-2)'};color:${k===cur?'var(--accent)':'var(--text)'};border-radius:20px;padding:5px 12px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:7px">
      <span style="display:inline-block;padding:0 6px;border-radius:3px;font-size:10px;font-weight:700;${v.prev}">Aa</span>${v.name}</button>`).join('');
}

// === L?: const setStatus8 ===
const setStatus8 = (m, t) => setStatusBar('status8', m, t);

// === L?: const t8State ===
const t8State = {
  audioFile: null,
  audioDuration: 0,
  alignResults: null  // [{id, text, oldDur, newStart, newEnd, newDur}]
};

// === L?: const T8_PROVIDERS ===
const T8_PROVIDERS = {
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/audio/transcriptions',
    model: 'whisper-large-v3-turbo',
    keyPrefix: 'gsk_',
    hint: '<strong>Groq</strong> (miễn phí): đăng ký tại <span style="color:var(--accent)">console.groq.com</span> → tạo key (không cần thẻ). Free tier 2.000 lượt/ngày, whisper-large-v3-turbo, file ≤25MB.',
    placeholder: 'Paste Groq API key (gsk_...)'
  },
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    model: 'whisper-1',
    keyPrefix: 'sk-',
    hint: '<strong>OpenAI Whisper</strong>: $0.006/phút. Key tại platform.openai.com. Cần nạp credit.',
    placeholder: 'Paste OpenAI API key (sk-...)'
  },
  local: {
    name: 'Local Browser',
    hint: '<strong>Local Browser</strong>: chạy Whisper ngay trên máy bằng transformers.js. Miễn phí, không cần key. Tải model ~150MB lần đầu. Chậm hơn (đặc biệt máy không GPU). Model base → kém chính xác hơn large-v3.',
    placeholder: 'Không cần key cho Local'
  }
};

// === L?: let t8SrtText ===
let t8SrtText = null;

async function t8TranscribeLocal(file){
  setStatus8('Đang tải Whisper model (lần đầu ~150MB)...', 'working');
  let transformers;
  try {
    transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
  } catch (e) {
    throw new Error('Không tải được transformers.js. Cần mạng + browser hỗ trợ ES module. Thử Groq thay thế.');
  }
  const { pipeline } = transformers;
  const lang = document.getElementById('t8Language')?.value ?? 'en';
  const localModel = t8PickModel('local', lang);
  setStatus8(`Đang tải model ${localModel}...`, 'working');
  const transcriber = await pipeline('automatic-speech-recognition', localModel);
  // Decode audio → Float32Array 16kHz mono
  const arrayBuf = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  const decoded = await audioCtx.decodeAudioData(arrayBuf);
  const raw = decoded.getChannelData(0);
  audioCtx.close();
  // ⚡ CHỐNG ĐƠ UI: xử lý theo TỪNG KHÚC 30s + NHẢ LUỒNG giữa các khúc (thay vì nuốt cả file 1 lần).
  const SR = 16000, CHUNK = 30 * SR;             // khúc 30 giây
  const total = raw.length, nChunks = Math.max(1, Math.ceil(total / CHUNK));
  const words = [];
  const isEn = localModel.endsWith('.en');
  // Khúc nào hỏng là mất trắng 30 giây từ → danh sách từ thủng một lỗ → cảnh nằm
  // đúng chỗ đó nuốt nguyên khoảng trống, thành cảnh dài hàng phút. Trước đây
  // chỉ console.warn nên không ai biết. Giờ đếm và báo ra ngoài.
  let khucHong = 0, khucRong = 0;
  _t8LocalStop = false;
  for (let ci = 0; ci < nChunks; ci++) {
    if (_t8LocalStop || (typeof state !== 'undefined' && state.cancelRequested)) { setStatus8('⏸ Đã dừng transcribe.', 'info'); break; }
    const off = ci * CHUNK;
    const seg = raw.subarray(off, Math.min(off + CHUNK, total));
    const opts = { return_timestamps: 'word' };
    if (lang && !isEn) opts.language = lang;
    let out;
    try { out = await transcriber(seg, opts); }
    catch (e) { console.warn('chunk ' + ci + ' lỗi:', e.message); out = null; khucHong++; }
    const baseT = off / SR;
    if (out && (!out.chunks || !out.chunks.length)) khucRong++;
    if (out && out.chunks) {
      for (const c of out.chunks) {
        const ts = c.timestamp || [];
        if (ts[0] == null) continue;
        words.push({ word: c.text, start: baseT + ts[0], end: baseT + (ts[1] != null ? ts[1] : ts[0]) });
      }
    }
    setStatus8(`🎤 Đang transcribe local… ${Math.round((ci + 1) / nChunks * 100)}% (khúc ${ci + 1}/${nChunks}) — bấm Dừng nếu muốn`, 'working');
    await new Promise(r => setTimeout(r, 40));    // nhả luồng cho UI thở giữa các khúc
  }
  if (!words.length) throw new Error('Local Whisper không ra timestamps. Thử Groq (nhanh + chính xác hơn, cần key ở Cài đặt).');
  try {
    novaLog('🎤 Căn timing chạy LOCAL bằng ' + localModel + ' (~74 triệu tham số) — nhỏ hơn bản Groq khoảng 11 lần, '
      + 'mốc thời gian kém chính xác hơn nhiều. Điền GROQ WHISPER API KEY ở Cài đặt để dùng whisper-large-v3 (miễn phí 2.000 lượt/ngày).',
      khucHong || khucRong ? 'warn' : 'info');
    if (khucHong || khucRong) novaLog('⚠️ Local Whisper: ' + khucHong + ' khúc lỗi, ' + khucRong + ' khúc không ra chữ, trên tổng ' + nChunks
      + ' khúc 30 giây. Mỗi khúc hụt là một lỗ ~30 giây trong dòng thời gian — cảnh rơi vào đó sẽ dài bất thường.', 'warn');
  } catch (_){}
  return words;
}

// === L?: let _t8LocalStop ===
let _t8LocalStop = false;

// === L?: const setStatus9 ===
const setStatus9 = (m, t) => setStatusBar('status9', m, t);

// === L?: const t9State ===
const t9State = { result: null };

// === L?: const setStatus11 ===
const setStatus11 = (m, t) => setStatusBar('status11', m, t);

// === L?: const YT_API ===
const YT_API = 'https://www.googleapis.com/youtube/v3';

// === L?: const _T11_SIGNAL ===
const _T11_SIGNAL = { direct_request: '🎯 Yêu cầu trực tiếp', question: '❓ Câu hỏi', gap: '🕳 Khoảng trống' };

// === L?: const T11_SIGNAL_WEIGHT ===
const T11_SIGNAL_WEIGHT = { direct_request: 3, gap: 2, question: 1 };

// === L?: const _uploadsOf ===
const _uploadsOf = channelId => 'UU' + String(channelId).slice(2);

// === L?: const NF_MAP ===
const NF_MAP = {
  hot:       { fn: 'hot',       state: 'nfHotState',   out: 'nfHotOut',   btn: 'nfHotBtn',   seed: 'nfHotSeed',   render: nfRenderHot },
  scorecard: { fn: 'scorecard', state: 'nfScState',    out: 'nfScOut',    btn: 'nfScBtn',    seed: 'nfScSeed',    render: nfRenderScorecard, key: 'channel' },
  bw:        { fn: 'bw',        state: 'nfBwState',    out: 'nfBwOut',    btn: 'nfBwBtn',    render: nfRenderBw },
  attention: { fn: 'attention', state: 'nfAttState',    out: 'nfAttOut',    btn: 'nfAttBtn',    seed: 'nfAttSeed',    render: nfRenderAttention },
};

// === L?: let _nfWired, _nfActive ===
let _nfWired = false, _nfActive = 'hot';

async function nfRun(mod, fresh){
  const m = NF_MAP[mod]; if (!m) return;
  if (!window.native || !window.native.niche){ document.getElementById(m.state).textContent = '⚠️ Chỉ chạy trong app Nova (desktop).'; return; }
  let payload = { fresh: !!fresh };
  if (mod === 'bw'){
    payload.title = (document.getElementById('nfBwTitle')?.value || '').trim();
    payload.niche = (document.getElementById('nfBwNiche')?.value || '').trim();
    if (!payload.title){ document.getElementById(m.state).textContent = '⚠️ Nhập tiêu đề cần chấm.'; return; }
  } else if (m.key){                                   // ô nhận KÊNH thay vì từ khoá ngách
    const v = (document.getElementById(m.seed)?.value || '').trim();
    if (!v){ document.getElementById(m.state).textContent = '⚠️ Nhập kênh đối thủ (@handle hoặc link).'; return; }
    payload[m.key] = v;
  } else {
    const seed = (document.getElementById(m.seed)?.value || '').trim();
    if (!seed){ document.getElementById(m.state).textContent = '⚠️ Nhập từ khoá ngách.'; return; }
    payload.seed = seed;
  }
  const btn = document.getElementById(m.btn); if (btn) btn.disabled = true;
  document.getElementById(m.state).textContent = '⏳ Đang chạy…'; _nfSet(m.out, '');
  try {
    const r = await window.native.niche[m.fn](payload);
    if (!r || !r.ok){ document.getElementById(m.state).textContent = '❌ ' + ((r&&r.error)||'Lỗi'); return; }
    m.render(r);
  } catch(e){ document.getElementById(m.state).textContent = '❌ ' + String(e).slice(0,150); }
  finally { if (btn) btn.disabled = false; }
}

// === L?: function _nfHotCard ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=815c, shared=594c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function _nfHotCard(t){
  const ratio = Number(t.ratio) || 0, n = Number(t.count) || 0;
  return `<div class="nf-card">
    <h5><span>🔥 ${_nfEsc(t.topic)}</span>${_nfBadge(t.heat)}</h5>
    <div class="tmet">
      ${ratio ? `<div>Bội số trung vị<b class="up">${ratio.toFixed(1)}×</b></div>` : ''}
      ${n ? `<div>Số video<b>${n}</b></div>` : ''}
    </div>
    <div class="nf-line"><b>Vì sao ăn:</b> ${_nfEsc(t.why)}</div>
    <div class="nf-line"><b>Góc làm:</b> ${_nfEsc(t.angle)}</div>
    ${t.title ? `<div class="nf-title-ex">🎬 ${_nfEsc(t.title)}</div>` : ''}
  </div>`;
}

// === L?: function nfRenderHot ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1154c, shared=990c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function nfRenderHot(r){
  document.getElementById('nfHotState').textContent =
    `✅ Quét ${(r.queries||[]).length} góc · ${r.scanned||0} video · trung vị ngách ${_t11oNum(r.median||0)} view` + _nfMeta(r);
  const items = r.items || [];
  const rising = items.filter(x => String(x.window||'').toLowerCase() === 'rising');
  const proven = items.filter(x => String(x.window||'').toLowerCase() !== 'rising');
  let h = '<div style="margin-bottom:10px">' + (r.queries||[]).map(q => `<span class="qchip">${_nfEsc(q)}</span>`).join('') + '</div>';
  if (rising.length) h += `<div class="win"><i class="r">ĐANG LÊN</i><em>đăng ≤ 30 ngày — còn chỗ chen vào</em><s></s></div>` + rising.map(_nfHotCard).join('');
  if (proven.length) h += `<div class="win"><i class="p">ĐÃ ĂN</i><em>30–180 ngày — chắc ăn nhưng đông người làm</em><s></s></div>` + proven.map(_nfHotCard).join('');
  _nfSet('nfHotOut', items.length ? h : '<div class="nf-state">Không có chủ đề nào vượt trung vị.</div>');
}

// === L?: let _nfScChannel ===
let _nfScChannel = '';

// === L?: function nfRenderScorecard ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=2423c, shared=2128c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function nfRenderScorecard(r){
  _nfScChannel = r.channel || '';
  document.getElementById('nfScState').textContent = `✅ Xong — ${r.videoCount} video · trung vị kênh ${_t11oNum(r.median||0)} view` + (r.fromCache?' · ⚡cache':'');
  const m = r.metrics || {};
  const ini = (r.channel||'?').replace(/[^\p{L}\p{N} ]/gu,'').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || 'YT';
  let h = `<div class="nf-card">
    <div class="sc-head">
      <div class="sc-av">${_nfEsc(ini)}</div>
      <div style="flex:1">
        <div style="font-size:16px;font-weight:700">${_nfEsc(r.channel)} ${r.monetized?'<span class="nf-badge nf-hi">Đã bật kiếm tiền</span>':''}</div>
        <div class="nf-state" style="margin:2px 0 0">${_t11oNum(r.subs||0)} sub · quét ${r.videoCount} video gần nhất</div>
      </div>
      <div style="text-align:right"><div style="font-size:26px;font-weight:800;color:var(--accent);line-height:1">${r.health}</div><div style="font-size:11px;color:var(--text-muted)">điểm sức khoẻ</div></div>
    </div>
    ${_nfMetricRows(m)}
    ${r.analysis ? `<div class="nf-title-ex" style="margin-top:12px;white-space:pre-wrap">${_nfEsc(r.analysis)}</div>` : ''}
  </div>`;
  if ((r.outliers||[]).length){
    h += `<div class="nf-card" style="padding:8px 12px"><table class="nf-tbl">
      <tr><th>Video vượt trội</th><th class="n">View</th><th class="n">Bội số</th><th class="n">Dài</th><th class="n">Tuổi</th></tr>
      ${r.outliers.map(o => `<tr>
        <td><a href="${_nfEsc(o.url)}" target="_blank" style="color:inherit;text-decoration:none">${_nfEsc(o.title)}</a></td>
        <td class="n">${_nfEsc(o.viewsFmt)}</td>
        <td class="n" style="color:var(--accent);font-weight:800">${o.ratio}×</td>
        <td class="n" style="color:var(--text-muted)">${Math.round((o.dur||0)/60)}p</td>
        <td class="n" style="color:var(--text-muted)">${o.days!=null?o.days+'n':'?'}</td></tr>`).join('')}
    </table></div>`;
  }
  _nfSet('nfScOut', h);
  const row = document.getElementById('nfSimRow'); if (row) row.style.display = 'flex';
  _nfSet('nfSimOut', '');
}

// === L?: const _NF_RUNGS ===
const _NF_RUNGS = [
  [86,100,'Hiếm: nhị phân bắt ngay + hàm ý sâu'],
  [71,85,'Rất mạnh, "vì sao phải click" hiển nhiên'],
  [51,70,'Hook rõ, có căng, làm được'],
  [21,50,'Có mới nhưng còn chung chung'],
  [0,20,'Tầm thường, dễ lướt qua'],
];

// === L?: function nfRenderBw ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=2044c, shared=1794c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function nfRenderBw(r){
  const d = r.result || {}, sc = Math.max(0, Math.min(100, Number(d.score)||0));
  const col = sc >= 71 ? 'var(--accent)' : sc >= 51 ? '#5fbf7f' : '#e08a8a';
  document.getElementById('nfBwState').textContent = `✅ Xong — ${r.chars} ký tự` + (d.layered ? ' · ý nhiều tầng' : '');
  const ladder = _NF_RUNGS.map(([lo,hi,txt]) => {
    const on = sc >= lo && sc <= hi;
    return `<div class="rung${on?' on':''}"><span class="rg">${lo}–${hi}</span><span class="rl"></span><span>${txt}${on?' ← <b>bạn ở đây</b>':''}</span></div>`;
  }).join('');
  const alts = (d.alts||[]).map(a => `<div class="alt"><span>${_nfEsc(a.title)}<div style="font-size:10.5px;color:var(--text-muted);margin-top:2px">${_nfEsc(a.why||'')}</div></span>
    <span class="nf-badge ${(Number(a.score)||0)>=71?'nf-hi':'nf-mid'}">${Number(a.score)||0}</span></div>`).join('');
  _nfSet('nfBwOut', `<div class="nf-card">
      <div class="bw-gauge">
        <div class="bw-ring" style="background:conic-gradient(${col} 0 ${sc}%,rgba(255,255,255,.07) ${sc}% 100%)"><b>${sc}</b><small>B&amp;W</small></div>
        <div style="flex:1;min-width:240px">${ladder}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
        <div class="pole"><b>Cực A tìm thấy</b>${d.poleA ? _nfEsc(d.poleA) : '<span style="color:var(--text-muted)">— không có —</span>'}</div>
        <div class="pole"><b>Cực B tìm thấy</b>${d.poleB ? _nfEsc(d.poleB) : '<span style="color:var(--text-muted)">— không có —</span>'}</div>
      </div>
      <div class="nf-state" style="margin-top:9px">${_nfEsc(d.verdict||'')}</div>
    </div>
    ${alts ? `<div class="nf-card"><h5 style="margin-bottom:8px">✍️ Viết lại theo cặp đối lập</h5>${alts}</div>` : ''}`);
}

// === L?: function nfRenderAttention ===
// ⚠️  DEDUP-DUPLICATE: hàm này cũng ở utility.js (peer=1619c, shared=1401c). Peer load SAU → ghi đè bản này. Sửa ở peer.
function nfRenderAttention(r){
  document.getElementById('nfAttState').textContent =
    `✅ Xong — ${r.scanned||0} video, ${r.outliers||0} vượt trội · trung vị ngách ${_t11oNum(r.median||0)} view` + _nfMeta(r);
  const cards = (r.items||[]).map(t => {
    const bw = Number(t.bw)||0;
    return `<div class="nf-card">
      <h5><span>🎯 ${_nfEsc(t.segment)}</span><span style="font-size:11.5px;font-weight:700;color:var(--accent);white-space:nowrap">🔥 ${t.fire||0} outlier</span></h5>
      <div class="nf-state" style="margin:0 0 5px">Nhu cầu: ${_nfEsc(t.demand||'')}${t.avgViews?` · view TB tệp ${_t11oNum(t.avgViews)}`:''}</div>
      <div class="nf-line"><b>Đang muốn:</b> ${_nfEsc(t.need)}</div>
      <div class="nf-title-ex">💡 ${_nfEsc(t.idea)} ${bw?`<span class="nf-badge ${bw>=71?'nf-hi':'nf-mid'}">B&amp;W ${bw}</span>`:''}
        ${t.poles?`<div style="font-size:10.5px;color:var(--text-muted);margin-top:4px">Cặp đối lập: ${_nfEsc(t.poles)}</div>`:''}</div>
      ${(t.samples||[]).length?`<div class="nf-state" style="margin-top:7px">Dựa trên: ${t.samples.map(s=>`<a href="${_nfEsc(s.url)}" target="_blank" style="color:var(--text-muted)">${_nfEsc(String(s.title).slice(0,44))} (${_nfEsc(s.viewsFmt)}, ${s.ratio}×)</a>`).join(' · ')}</div>`:''}
    </div>`;
  }).join('');
  _nfSet('nfAttOut', cards || '<div class="nf-state">Không dựng được tệp khán giả nào.</div>');
}

// === L?: let _nfWv ===
let _nfWv = null;

// === L?: const setStatus10 ===
const setStatus10 = (m, t) => setStatusBar('status10', m, t);

// === L?: const t10State ===
const t10State = { refs: [], results: [], loadedProfileId: null };

// === L?: const t9Ref ===
const t9Ref = { mode: 'topic', items: [], sel: null, base64: null, mime: '' };

// === L?: const T9_REF_RULE ===
const T9_REF_RULE = ' The attached reference image is the TEMPLATE. Match its art technique, background treatment, layout skeleton, caption styling and position, callout devices, palette and contrast as closely as possible — a viewer should recognise them as the same template. '
  + 'Change only the depicted subject and label wording so they fit this video. '
  + 'Never reproduce a recognisable real person, a logo or a brand mark from the reference.';

// === L?: const _hasViet ===
const _hasViet = (x) => /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(String(x || ''));

async function _t9RefTopicQuery(){
  const src = _t9RefTopicSource();
  if (!src.txt) return { q: '', from: '' };
  let q = src.txt.replace(/["“”'’|—–\-:!?.,]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (_hasViet(q) && typeof callLLM === 'function'){
    try {
      const r = await callLLM(`Đổi mô tả video sau thành 3-6 TỪ KHOÁ TIẾNG ANH để tìm video cùng chủ đề trên YouTube. Chỉ in từ khoá, cách nhau bằng dấu phẩy, không giải thích.\n\n"${q.slice(0, 200)}"`, { maxTokens: 60 });
      const k = String(r || '').replace(/[\n"]+/g, ' ').trim();
      if (k && k.length < 120) q = k;
    } catch (e) {}
  }
  return { q: q.split(' ').slice(0, 9).join(' '), from: src.from };
}

// === L?: let _t9RefAuto ===
let _t9RefAuto = false;

async function t10Generate(){
  if (typeof gateTool==='function' && gateTool('tool9')) return;
  const title = t10GetTitle();
  if (!title) return setStatus10('Cần TIÊU ĐỀ (tự lấy từ Tạo Kịch Bản/SEO, hoặc gõ vào ô Tiêu đề).', 'error');

  const count = parseInt(document.getElementById('t10Count').value) || 1;
  const p = getProfile();
  const style = (p && p.thumbPrompt) ? p.thumbPrompt.trim() : '';
  const { withText, text } = t10TextSpec();
  const refs = t10State.refs.map((r, i) => ({ name: `mau_${i + 1}`, base64: r.base64, mime: r.mime }));
  // 🖼 Ảnh mẫu chọn ở khối "Ảnh mẫu thumbnail" → đưa lên ĐẦU danh sách ref + gắn luật bắt chước (ẩn).
  const _hasRef = !!(typeof t9Ref === 'object' && t9Ref && t9Ref.base64);
  if (_hasRef) refs.unshift({ name: 'bo_cuc_mau', base64: t9Ref.base64, mime: t9Ref.mime || 'image/jpeg' });
  const _refItem = _hasRef ? (t9Ref.items || [])[t9Ref.sel] : null;

  // 1) AI viết N ý tưởng prompt khác nhau
  let concepts = [], _refCaps = [];
  if (_hasRef) {
    // Có ảnh mẫu → đọc mẫu bằng vision rồi TÁI DỰNG đúng bố cục, chỉ đổi chủ thể/chữ cho khớp tiêu đề.
    setStatus10('👁 Đang đọc bố cục ảnh mẫu…', 'working');
    const spec = await _t9RefDescribe();
    // Mẫu có chữ → AI tự nghĩ N câu khác nhau (mỗi phương án một câu). Mẫu không chữ → không thêm chữ.
    if (spec && spec.caption) {
      _refCaps = await _t9CaptionsFromPattern(title, count);
      if (_refCaps.length) setStatus10(`✍️ Chữ trên ảnh: ${_refCaps.map(c => '"' + c + '"').join(' · ')}`, 'working');
    }
    if (spec) {
      concepts = _t9RefConcepts(spec, title, count, _refCaps);
      const bits = [spec.caption ? 'có chữ' : 'không chữ', spec.secondaryText.length ? spec.secondaryText.length + ' nhãn' : 'không nhãn'];
      setStatus10(`Đã đọc khuôn (${bits.join(' · ')}) — tạo ${count} ảnh bám mẫu…`, 'working');
    }
  }
  if (!concepts.length) {
    setStatus10(`AI đang viết ${count} ý tưởng thumbnail khác nhau từ tiêu đề + style kênh...`, 'working');
    try { concepts = await t10MakeConcepts(style, title, count); } catch (e) { concepts = []; }
  }
  if (!concepts.length) {
    concepts = [`${style || 'A bold high-contrast viral YouTube thumbnail in 16:9.'}\n\nVIDEO TOPIC: "${title}". A specific fresh scene for this topic, one clear focal subject with strong exaggerated emotion, clear space on one side for a caption.`];
  }
  const N = concepts.length;

  // Ghép chữ + ref role vào từng concept.
  // idx 0 khi có ảnh mẫu VÀ tạo ≥2 ảnh → giữ NGUYÊN chữ gốc của ảnh mẫu để so sánh.
  const buildFinal = (scene, idx) => {
    let pr = scene;
    if (_hasRef) pr += ' ' + T9_REF_RULE;
    if (_hasRef) {
      // Luật chữ/nhãn đã nằm trong concept (dựng từ spec của mẫu) → ở đây chỉ gắn vai trò ảnh tham chiếu.
      if (refs.length) pr += _refRoleNote(refs.map(r => r.name));
      return pr;
    }
    if (withText && text) {
      pr += ` IMPORTANT — render this exact caption baked into the image, spelled EXACTLY: "${text}". Bold YouTube thumbnail caption: large uppercase sans-serif, the single most important word in bright red, the rest black or white with a subtle outline, placed in the empty area beside the subject. Add a hand-drawn black curved arrow pointing from the caption toward the subject. No other text anywhere in the image.`;
    } else {
      pr += ` The image must contain absolutely NO text, letters, numbers, words or logos — leave the side area clean so a caption can be added later.`;
    }
    if (refs.length) pr += _refRoleNote(refs.map(r => r.name));
    return pr;
  };

  // 2) Sẵn sàng Flow?
  if (!(await flowBridge.waitReady(1500))) {
    return setStatus10('Chưa kết nối Flow. Vào Cài đặt → kết nối tài khoản Flow (extension) trước.', 'error');
  }
  const cfg = (typeof tfCfg === 'function') ? tfCfg() : {};
  const model = cfg.model || undefined;
  const quality = cfg.quality || 'orig';

  t10State.results = [];
  document.getElementById('t10Results').innerHTML = '';
  document.getElementById('t10ResultPanel').style.display = 'block';
  clearCancel();

  // Chạy SONG SONG theo ô "Luồng song song" ở Cài đặt (trước đây tạo tuần tự từng ảnh, rất chậm).
  const _lanes = Math.max(1, Math.min(N, parseInt(document.getElementById('tfConc')?.value) || 2));
  let _done = 0, _err = '';
  const _one = async (i) => {
    if (state.cancelRequested) return;
    try {
      const r = await flowBridge.call('POOL_GEN', { prompt: buildFinal(concepts[i], i), aspect: 'IMAGE_ASPECT_RATIO_LANDSCAPE', modelName: model, quality, variantCount: 1, withData: true, refs });
      if (r?.error) throw new Error(r.error);
      const e0 = (r?.media_entries || []).find(e => e.dataUrl || e.b64);
      if (!e0) throw new Error('Flow không trả ảnh (kiểm tra tài khoản/quota).');
      const dataUrl = e0.dataUrl || (`data:${e0.mime || 'image/png'};base64,${e0.b64}`);
      t10State.results.push({ dataUrl, mime: e0.mime || 'image/png' });
      t10RenderResults();
    } catch (e) { _err = `Ảnh ${i + 1}: ${String(e.message || e).slice(0, 120)}`; }
    _done++;
    setStatus10(`Đang tạo thumbnail… ${_done}/${N}${_lanes > 1 ? ` (⚡ ${_lanes} luồng)` : ''}`, 'working');
  };
  const _idx = Array.from({ length: N }, (_, i) => i);
  if (typeof runConcurrent === 'function') await runConcurrent(_idx, _one, _lanes, () => state.cancelRequested);
  else for (const i of _idx) { if (state.cancelRequested) break; await _one(i); }
  if (_err && !t10State.results.length) { setStatus10('Lỗi ' + _err, 'error'); return; }
  if (t10State.results.length) {
    setStatus10(`✓ Xong ${t10State.results.length}/${N} thumbnail${_err ? ' · ' + _err : ''}. Tải về, chọn cái đẹp nhất.`, _err ? 'info' : 'ok');
    notifyDone('✓ Thumbnail xong!', `${t10State.results.length} ảnh đã tạo.`);
  }
}

/* === _BE_MO_TA stub (recovered for v2 extractor future-proofing) === */
const _BE_MO_TA = { omni: { mo: 'OmniVoice' }, vieneu: { mo: 'VieNeu' }, xtts: { mo: 'XTTS' } };

