# Smart SEO Auth (Cloudflare Workers)

**কি আছে:**  
- একটি Worker যা **লগইন (সিঙ্গেল ইউজার)** ছাড়া কোনো ফাইল সার্ভ করবে না  
- সফল লগইনের পর `public/` থেকে আপনার অ্যাপ (index.html) সার্ভ হবে  
- কুকি সেশন: `HttpOnly; Secure; SameSite=Strict`  
- GitHub → Cloudflare Workers **অটো ডিপ্লয়** (GitHub Actions)

> `public/index.html` এ আপনার আপলোড করা অ্যাপ রাখা আছে।

## ডিফল্ট লগইন (ডিপ্লয়ের পর সাথে সাথে টেস্ট করার জন্য)
- **Username:** `admin`
- **Password:** `tJ#2r!LqZm2$79XdlE`

> মারাত্মক অনুরোধ: রিপোজিটরি পাবলিক হলে সাথে সাথে পাসওয়ার্ড বদলান।

---

## কিভাবে কনফিগ বদলাবেন (GitHub-এই)
১) রিপোতে `wrangler.toml` ওপেন করুন → `[vars]` সেকশনে দেখবেন:  
- `USERNAME` – আপনার ইউজারনেম  
- `PASS_SALT_B64`, `PASS_DERIVED_B64`, `PASS_ITER` – পাসওয়ার্ড ভেরিফাইয়ের সেটআপ  
- `SESSION_SECRET` – সেশন সাইন করার সিক্রেট (লম্বা র‍্যান্ডম স্ট্রিং)

২) পাসওয়ার্ড বদলাতে `tools/generate.html` লোকালি ব্রাউজারে খুলুন → নতুন পাসওয়ার্ড লিখে **Generate** চাপুন → পাওয়া `PASS_SALT_B64` ও `PASS_DERIVED_B64` কপি করে `wrangler.toml` এ পেস্ট করুন → কমিট করুন।

৩) চাইলে `USERNAME`, `SESSION_SECRET`-ও বদলান।

কমিট করলেই GitHub Actions **অটো ডিপ্লয়** করবে।

---

## ডিপ্লয় (GitHub Actions)
রিপোজিটরি → **Settings → Secrets and variables → Actions** এ গিয়ে দুটো **Secrets** যোগ করুন:

- `CLOUDFLARE_API_TOKEN` – Cloudflare Dashboard থেকে তৈরি করা API Token (Workers ডিপ্লয়ের অনুমতি সহ)  
- `CLOUDFLARE_ACCOUNT_ID` – আপনার Cloudflare Account ID

> এগুলো দেওয়ার পর `main` ব্রাঞ্চে পুশ হলেই `.github/workflows/deploy.yml` রান করে ডিপ্লয় হবে। ডিপ্লয় লগে **deployment URL** দেখা যাবে।
> প্রয়োজনে `wrangler.toml` এ `name = "smart-seo-auth"` বদলালে worker.dev URL-ও বদলাবে।

## লোকাল রান (ঐচ্ছিক)
```bash
npm i -g wrangler
wrangler dev
wrangler deploy
```

## সিকিউরিটি নোট
- `run_worker_first = true` থাকার কারণে **প্রতিটি রিকোয়েস্ট আগে Worker** এ আসবে—তাই লগইন ছাড়া কিছু সার্ভ হবে না।
- রিপো যদি পাবলিক হয়, `[vars]` এর ভ্যালুগুলো সবাই দেখতে পারে। **প্রাইভেট রিপো** রাখাই ভালো।
- Turnstile/রেট-লিমিট লাগলে আমাকে বলুন, আমি অ্যাড করে দেব।

— প্রস্তুত করেছেন: আপনার সহকারী 🤝
