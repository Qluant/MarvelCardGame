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
