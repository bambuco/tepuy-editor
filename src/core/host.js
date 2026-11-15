/**
 * @file Client for the Tepuy test host.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

/** Token of the local test host. It is not written into a package. */
export const DEV_TOKEN = 'tepuy-dev';

/**
 * Failure reported by the host with one of its typed codes.
 */
export class HostError extends Error {
  /**
   * @param {string} code conflict, forbidden, not_found, too_large, or invalid.
   * @param {string} message Short explanation.
   */
  constructor(code, message) {
    super(message);
    this.name = 'HostError';
    this.code = code;
  }
}

/**
 * @param {string} value Date or datetime typed by the user.
 * @param {boolean} end Whether a date-only value closes the day.
 * @returns {string} Bound comparable with an ISO timestamp.
 */
function bound(value, end) {
  if (!value) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}${end ? 'T23:59:59+00:00' : 'T00:00:00+00:00'}`;
  }
  return value;
}

/**
 * @param {Object[]} entries Log rows.
 * @param {{user?: string, operation?: string, from?: string, to?: string}} [filter] Active filters.
 * @returns {Object[]} Entries that match every filled filter.
 */
export function filterLog(entries, filter = {}) {
  const user = (filter.user || '').trim().toLowerCase();
  const operation = filter.operation || '';
  const from = bound(filter.from || '', false);
  const to = bound(filter.to || '', true);
  return entries.filter((entry) => {
    if (user) {
      const id = String(entry.user?.id || '').toLowerCase();
      const name = String(entry.user?.name || '').toLowerCase();
      if (!id.includes(user) && !name.includes(user)) {
        return false;
      }
    }
    if (operation && entry.operation !== operation) {
      return false;
    }
    const stamp = String(entry.timestamp || '');
    if (from && stamp < from) {
      return false;
    }
    if (to && stamp > to) {
      return false;
    }
    return true;
  });
}

/**
 * @param {{url?: string, token?: string, fetchImpl?: Function}} [options] Endpoint and credentials.
 * @returns {Object} Host operations used by the editor.
 */
export function createHostClient({ url, token = DEV_TOKEN, fetchImpl } = {}) {
  const endpoint = url || new URL('../api/index.php', import.meta.url).href;
  const fetcher = fetchImpl || globalThis.fetch.bind(globalThis);

  /**
   * @param {string} action Host action name.
   * @param {{method?: string, query?: Object<string, string>, body?: Object, form?: FormData}} [options] Request parts.
   * @returns {Promise<Object|Blob>} Decoded response.
   */
  async function request(action, { method = 'GET', query = {}, body, form } = {}) {
    const target = new URL(endpoint, globalThis.location?.href || 'http://localhost/');
    target.searchParams.set('action', action);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        target.searchParams.set(key, String(value));
      }
    }
    const headers = {
      Authorization: `Bearer ${token}`,
      'X-Tepuy-Token': token,
    };
    /** @type {BodyInit|undefined} */
    let payload;
    if (form) {
      payload = form;
    }
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const response = await fetcher(target, { method, headers, body: payload });
    if (action === 'download') {
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new HostError(data.error || 'invalid', data.message || 'Host error.');
      }
      return response.blob();
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new HostError(data.error || 'invalid', data.message || 'Host error.');
    }
    return data;
  }

  return {
    capabilities: () => request('capabilities'),
    getUser: () => request('getUser'),
    create: ({ name, themeId }) => request('create', { method: 'POST', body: { name, themeId } }),
    open: (ref) => request('open', { query: { ref } }),
    async listPackages() {
      const data = await request('listPackages');
      return data.packages || [];
    },
    async list(ref) {
      const data = await request('list', { query: { ref } });
      return data.files || [];
    },
    async read(ref, path) {
      const data = await request('read', { query: { ref, path } });
      if (data.encoding === 'base64') {
        throw new HostError('invalid', 'Binary files are not opened as text.');
      }
      return data.content;
    },
    commit: (ref, changes, baseRevision) => request('commit', {
      method: 'POST',
      body: { ref, changes, baseRevision },
    }),
    tempUpload(ref, file) {
      const form = new FormData();
      form.set('file', file);
      return request('tempUpload', { method: 'POST', query: { ref }, form });
    },
    download: (ref) => request('download', { query: { ref } }),
    appendLog: (ref, entries) => request('appendLog', { method: 'POST', body: { ref, entries } }),
    async listLog(ref, filter = {}) {
      const data = await request('listLog', { query: { ref, ...filter } });
      return data.entries || [];
    },
  };
}
