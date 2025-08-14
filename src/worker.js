const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes) {
  let bin = ""; bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function b64urlDecodeToBytes(b64url) {
  let s = b64url.replace(/-/g,"+").replace(/_/g,"/"); while (s.length%4) s+="=";
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out;
}
async function pbkdf2(password, saltB64, iter) {
  const keyMat = await crypto.subtle.importKey("raw", enc.encode(password), {name:"PBKDF2"}, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    {name:"PBKDF2", hash:"SHA-256", salt:b64urlDecodeToBytes(saltB64), iterations:iter},
    keyMat, 256
  );
  return b64urlEncode(new Uint8Array(bits));
}
function timingSafeEqual(a,b){ if(a.length!==b.length) return false; let out=0; for(let i=0;i<a.length;i++) out|=a.charCodeAt(i)^b.charCodeAt(i); return out===0; }
async function hmac(payload, secret){
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64urlEncode(new Uint8Array(sig));
}
async function makeSession(username, ttl, secret){
  const exp = Math.floor(Date.now()/1000)+ttl;
  const payload = b64urlEncode(enc.encode(JSON.stringify({u:username,e:exp})));
  const sig = await hmac(payload, secret);
  return `${payload}.${sig}`;
}
async function checkSession(cookieHeader, secret){
  const m = (cookieHeader||"").match(/sid=([^;]+)/);
  if(!m) return false;
  const [payload, sig] = m[1].split(".");
  if(!payload||!sig) return false;
  const expect = await hmac(payload, secret);
  if(!timingSafeEqual(sig, expect)) return false;
  const {e} = JSON.parse(dec.decode(b64urlDecodeToBytes(payload)));
  return e > Math.floor(Date.now()/1000);
}

// Domain-less cookies
function clearCookie(){
  return `sid=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
function setCookie(sid, ttl){
  return `sid=${sid}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Strict`;
}

function loginPage(url, err=""){
  const msg = err ? `<div style="color:#ff5d75;margin-bottom:10px;font-weight:700">${err}</div>` : "";
  return new Response(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login</title>
<style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;background:#0b0f17;color:#fff;display:grid;place-items:center;height:100vh}
.card{width:min(420px,92vw);background:#1b2430;border:1px solid #334066;border-radius:14px;padding:22px;box-shadow:0 10px 26px rgba(0,0,0,.45)}
h1{margin:0 0 8px 0;font-size:20px}label{font-weight:700;font-size:13px;margin-top:10px;display:block}
.input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #334066;background:rgba(0,0,0,.2);color:#fff}
.btn{margin-top:14px;width:100%;padding:10px 12px;border-radius:999px;border:0;background:#7c5cff;color:#fff;font-weight:800;cursor:pointer}
.small{opacity:.7;font-size:12px;margin-top:8px}</style></head>
<body>
<form class="card" method="POST" action="/auth/login">
<h1>Sign in</h1>${msg}
<input type="hidden" name="next" value="${url.pathname}${url.search}">
<label>Username</label><input class="input" name="username" autocomplete="username" required>
<label>Password</label><input class="input" type="password" name="password" autocomplete="current-password" required>
<button class="btn" type="submit">Login</button>
<div class="small">Protected by Cloudflare Worker (cookie session)</div>
</form></body></html>`, {headers:{'content-type':'text/html; charset=utf-8'}});
}

export default {
  async fetch(request, env, ctx){
    const USERNAME = env.USERNAME ?? "admin";
    const PASS_ITER = Number(env.PASS_ITER ?? 150000);
    const PASS_SALT_B64 = env.PASS_SALT_B64 ?? "OFJlvU9Xl3z0_jeBa7lZZA";
    const PASS_DERIVED_B64 = env.PASS_DERIVED_B64 ?? "sZbjscuNb8d_7ljA6EoOprV3eCZH0wv-Fl1BeM8-Cfg";
    const SESSION_SECRET = env.SESSION_SECRET ?? "6R6XOeZFlVbaChWd5pvoNVA8th2CK5KoXYjOiPER8b5Z5G_wedqKK3byDAc0IVYA";
    const SESSION_TTL_SECONDS = Number(env.SESSION_TTL_SECONDS ?? 7*24*60*60);

    const url = new URL(request.url);

    if (url.pathname === "/auth/login"){
      if (request.method === "GET") return loginPage(url);
      if (request.method === "POST"){
        let username="", password="", next="/";
        const ct = request.headers.get("content-type") || "";
        if (ct.includes("application/json")){
          const body = await request.json().catch(()=>({}));
          username=body.username||""; password=body.password||""; next=body.next||"/";
        } else {
          const form = await request.formData();
          username = form.get("username") || "";
          password = form.get("password") || "";
          next = form.get("next") || "/";
        }
        if (username !== USERNAME) return loginPage(url, "Invalid username or password.");
        const derived = await pbkdf2(password, PASS_SALT_B64, PASS_ITER);
        if (!timingSafeEqual(derived, PASS_DERIVED_B64)) return loginPage(url, "Invalid username or password.");
        const sid = await makeSession(username, SESSION_TTL_SECONDS, SESSION_SECRET);
        const res = Response.redirect(new URL(next, url), 302);
        res.headers.set("Set-Cookie", setCookie(sid, SESSION_TTL_SECONDS));
        return res;
      }
      return new Response("Method Not Allowed", {status:405});
    }

    if (url.pathname === "/auth/logout"){
      const res = new Response("Logged out", {status:200});
      res.headers.set("Set-Cookie", clearCookie());
      res.headers.set("content-type","text/plain; charset=utf-8");
      return res;
    }

    if (url.pathname === "/health") return new Response("ok");

    const ok = await checkSession(request.headers.get("Cookie"), SESSION_SECRET);
    if (!ok) return loginPage(url);

    return env.ASSETS.fetch(request);
  }
}