/**
 * Browser implementation of `window.api` (the old Electron preload bridge).
 * `window.api.pannes.list(opts)` → POST /api/rpc { method: 'pannes:list', args: [opts] }.
 * The few calls that were desktop-only (file pickers, printing) are done
 * in the browser instead.
 */

const SESSION_KEY = 'cph.session';

export interface Session {
  token: string;
  user: { id: number; username: string; full_name: string; role: any };
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode: session lasts until the tab closes */
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function rpc(method: string, args: unknown[]): Promise<any> {
  const token = loadSession()?.token;
  let res: Response;
  try {
    res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ method, args }),
    });
  } catch {
    throw new Error('Pas de connexion Internet.');
  }
  const data = await res.json().catch(() => ({ error: `Erreur serveur (${res.status}).` }));
  if (res.status === 401 && method !== 'auth:login') onUnauthorized();
  if (!res.ok) throw new Error(data.error ?? `Erreur serveur (${res.status}).`);
  return data.result;
}

/* ---------- browser replacements for desktop-only calls ---------- */

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // no event fires on cancel in every browser; a dangling promise is harmless here
    input.click();
  });
}

/** Shrinks a phone photo to ≤1600px JPEG so uploads stay small and fast. */
async function photoToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image illisible.'));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}

function download(filename: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const local: Record<string, Record<string, (...args: any[]) => Promise<any>>> = {
  photos: {
    pick: async () => {
      const file = await pickFile('image/*');
      return file ? photoToDataUrl(file) : null;
    },
  },
  print: {
    document: async (html: string) => printHtml(html),
  },
  backup: {
    create: async (actorId: number) => {
      const data = await rpc('backup:create', [actorId]);
      download(`caisse-panne-hotel-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data));
      return { path: 'download' };
    },
    restore: async (actorId: number) => {
      const file = await pickFile('.json,application/json');
      if (!file) return false;
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error("Ce fichier n'est pas une sauvegarde valide.");
      }
      if (!confirm('Restaurer écrasera toutes les données actuelles, pour tous les utilisateurs. Continuer ?')) return false;
      await rpc('backup:restore', [actorId, data]);
      return true;
    },
  },
};

export function installApi() {
  (window as any).api = new Proxy(
    {},
    {
      get: (_t, ns: string) =>
        new Proxy(
          {},
          { get: (_t2, fn: string) => local[ns]?.[fn] ?? ((...args: any[]) => rpc(`${ns}:${fn}`, args)) }
        ),
    }
  );
}
