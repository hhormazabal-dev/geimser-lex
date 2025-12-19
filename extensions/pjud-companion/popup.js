const statusEl = document.getElementById('status');
const connectBtn = document.getElementById('connect');

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = `status ${kind || ''}`;
}

connectBtn.addEventListener('click', async () => {
  connectBtn.disabled = true;
  setStatus('Conectando…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No hay pestaña activa.');

    await chrome.runtime.sendMessage({ type: 'APP_CONNECT', tabId: tab.id });
    setStatus('Listo. Vuelve a la plataforma y prueba “Buscar causas”.', 'ok');
  } catch (e) {
    setStatus(e?.message ?? 'No se pudo conectar.', 'err');
  } finally {
    connectBtn.disabled = false;
  }
});

