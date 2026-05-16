// Api module — all fetch calls go through here.
// Automatically attaches Authorization header when token exists.
// All methods return { res, data } so callers can check res.ok and read data.

const API_URL = '/api';

const Api = {
  _headers(withBody = false) {
    const token = localStorage.getItem('token');
    const h = {};
    if (withBody) h['Content-Type'] = 'application/json';
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  },

  async get(path) {
    const res = await fetch(API_URL + path, { headers: this._headers() });
    const data = await res.json();
    return { res, data };
  },

  async post(path, body) {
    const res = await fetch(API_URL + path, {
      method: 'POST',
      headers: this._headers(true),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { res, data };
  },

  async put(path, body) {
    const res = await fetch(API_URL + path, {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { res, data };
  },
};
