const HOST = 'com.ganymede.code.browser';
let port;
const attachedTabs = new Set();

function connect() {
  if (port) return port;
  port = chrome.runtime.connectNative(HOST);
  port.onMessage.addListener((message) => {
    void handle(message);
  });
  port.onDisconnect.addListener(() => {
    port = undefined;
    attachedTabs.clear();
  });
  return port;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab.');
  return tab;
}

async function attach(tabId) {
  if (attachedTabs.has(tabId)) return;
  await chrome.debugger.attach({ tabId }, '1.3');
  attachedTabs.add(tabId);
}

async function command(tabId, method, params = {}) {
  await attach(tabId);
  return chrome.debugger.sendCommand({ tabId }, method, params);
}

async function handle(message) {
  const id = message?.id ?? crypto.randomUUID();
  try {
    const tab = message.tabId ? await chrome.tabs.get(message.tabId) : await activeTab();
    const tabId = tab.id;
    let result;
    switch (message.method) {
      case 'state':
        result = { tabId, url: tab.url, title: tab.title };
        break;
      case 'navigate':
        await chrome.tabs.update(tabId, { url: message.url });
        result = true;
        break;
      case 'screenshot': {
        const image = await command(tabId, 'Page.captureScreenshot', { format: 'png' });
        result = `data:image/png;base64,${image.data}`;
        break;
      }
      case 'click':
        await command(tabId, 'Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: message.x,
          y: message.y,
          button: 'left',
          clickCount: 1,
        });
        await command(tabId, 'Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: message.x,
          y: message.y,
          button: 'left',
          clickCount: 1,
        });
        result = true;
        break;
      case 'type':
        await command(tabId, 'Input.insertText', { text: message.text ?? '' });
        result = true;
        break;
      case 'inspect':
        result = await command(tabId, 'Runtime.evaluate', {
          expression: `({
            text: document.body?.innerText?.slice(0, 50000) ?? '',
            html: document.documentElement?.outerHTML?.slice(0, 200000) ?? ''
          })`,
          returnByValue: true,
        });
        break;
      default:
        throw new Error(`Unknown method: ${String(message.method)}`);
    }
    connect().postMessage({ id, ok: true, result });
  } catch (error) {
    connect().postMessage({ id, ok: false, error: error?.message ?? String(error) });
  }
}

chrome.action.onClicked.addListener(async () => {
  try {
    const tab = await activeTab();
    connect().postMessage({
      type: 'connected',
      tabId: tab.id,
      url: tab.url,
      title: tab.title,
    });
  } catch {
    // Chrome surfaces native-host failures in chrome://extensions.
  }
});
