const CHANNEL_REQUEST = 'PJUD_COMPANION_REQUEST';
const CHANNEL_RESPONSE = 'PJUD_COMPANION_RESPONSE';

function postResponse(requestId, ok, data, error) {
  window.postMessage(
    {
      type: CHANNEL_RESPONSE,
      requestId,
      ok,
      data: ok ? data : null,
      error: ok ? null : (error || 'Unknown error'),
    },
    '*',
  );
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.type !== CHANNEL_REQUEST) return;

  const { requestId, action, payload } = msg;
  if (!requestId || !action) return;

  try {
    const res = await chrome.runtime.sendMessage({ type: 'APP_REQUEST', requestId, action, payload });
    if (res && typeof res === 'object' && res.ok === false) {
      throw new Error(res.error || 'Error PJUD Companion');
    }
    postResponse(requestId, true, res);
  } catch (e) {
    postResponse(requestId, false, null, e?.message ?? 'Extension error');
  }
});
