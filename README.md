# achat

Discord benzeri, kendine has minimalist tasarıma sahip gerçek zamanlı sohbet uygulaması.

## Özellikler

- Kayıt / giriş (JWT tabanlı kimlik doğrulama)
- Sunucu oluşturma, davet kodu ile katılma, sunucu ayarları
- Metin kanalları, gerçek zamanlı mesajlaşma (Socket.IO)
- Mesaj düzenleme / silme, emoji, @kullanıcı ve @rol etiketleme
- Sunucu botları (küfür filtresi, karşılama, !zar, !şaka, !8ball)
- Rol yönetimi, üye detay paneli, katılım duyuruları
- Kişiden kişiye özel mesaj (DM) ve arkadaşlık sistemi
- Sesli sohbet kanalları ve ekran paylaşımı (WebRTC)
- Tema sistemi (koyu temalar + dizi temaları)

## Teknolojiler

| Katman | Teknoloji |
| --- | --- |
| **Backend** | Node.js, Express, TypeScript |
| **Veritabanı** | PostgreSQL, Prisma ORM |
| **Gerçek zamanlı** | Socket.IO |
| **Frontend** | React 18, Vite, TypeScript |
| **State yönetimi** | Zustand |
| **HTTP istemcisi** | Axios |
| **Routing** | React Router |
| **Kimlik doğrulama** | JWT, bcrypt |
| **Doğrulama** | Zod |
| **Güvenlik** | Helmet, express-rate-limit, CORS |
| **Ses / ekran** | WebRTC (mesh) |

## Gereksinimler

- Node.js 20+
- Docker (yerel PostgreSQL için) veya harici bir PostgreSQL sunucusu

## Kurulum

### 1. PostgreSQL

Docker ile (önerilen):

```bash
docker compose up -d
```

Harici PostgreSQL kullanıyorsan `server/.env` içindeki `DATABASE_URL` değerini kendi bağlantı bilgine göre ayarla.

### 2. Backend

```bash
cd server
copy .env.example .env   # Windows
# cp .env.example .env   # macOS / Linux
npm install
npm run db:push          # PostgreSQL şemasını oluşturur
npm run dev              # http://localhost:4000
```

### 3. Frontend

```bash
cd client
npm install
npm run dev              # http://localhost:5173
```

Tarayıcıdan `http://localhost:5173` adresini aç. İki farklı tarayıcı veya sekmede farklı hesaplarla giriş yaparak sohbet, ses ve ekran paylaşımını test edebilirsin.

## Faydalı komutlar

```bash
# Kök dizinden
npm run build            # production build (server + client)
npm run db:push          # şemayı veritabanına uygula

# server/
npm run create-user      # CLI ile kullanıcı oluştur
npm run seed-server-defaults  # mevcut sunuculara varsayılan rol/bot ekle
npm run db:studio        # Prisma Studio (veritabanı arayüzü)
```

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `DATABASE_URL` | PostgreSQL bağlantı dizesi |
| `JWT_SECRET` | JWT imzalama anahtarı (üretimde güçlü bir değer kullan) |
| `PORT` | Backend portu (varsayılan: 4000) |
| `CLIENT_ORIGIN` | Frontend URL (CORS için, örn. `http://localhost:5173`) |
| `VITE_API_URL` | Client build için backend URL (üretimde gerekli) |

## Demo hesaplar

| E-posta | Şifre |
| --- | --- |
| `demo@achat.local` | `demo1234` |
| `achat2@achat.local` | `demo1234` |

> Demo hesaplar veritabanında yoksa: `cd server && npm run create-user demo demo@achat.local demo1234`

## Deploy (Neon + Render — ücretsiz başlangıç)

**Neon** → PostgreSQL (ücretsiz)  
**Render** → Backend API + Frontend (ücretsiz tier; 15 dk hareketsizlikten sonra uyur, ilk istek yavaş olabilir)

### Adım 1 — GitHub

Repoyu GitHub’a push et.

### Adım 2 — Neon (veritabanı)

1. [neon.tech](https://neon.tech) → GitHub ile kayıt
2. **New Project** → proje adı: `achat`
3. **Connection string** kopyala (ör. `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)
4. Bu değeri sakla → Render’da `DATABASE_URL` olacak

### Adım 3 — Render (backend)

1. [render.com](https://render.com) → GitHub ile kayıt
2. **New +** → **Blueprint** → GitHub reposunu seç (`render.yaml` otomatik algılanır)
3. Veya manuel: **Web Service** → repo → **Root Directory:** `server`
4. Ortam değişkenleri:

| Değişken | Değer |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon connection string |
| `JWT_SECRET` | uzun rastgele string |
| `CLIENT_ORIGIN` | *(şimdilik boş — adım 5’te doldur)* |

5. **Build Command:** `npm ci --include=dev && npm run build`  
6. **Start Command:** `npm start`  
7. **Release Command:** `npx prisma db push`  
8. Deploy bitince API URL’ini al (ör. `https://achat-api.onrender.com`)
9. Test: `https://achat-api.onrender.com/api/health`

### Adım 4 — Render (frontend)

1. **New +** → **Static Site** → aynı repo
2. **Root Directory:** `client`
3. **Build Command:** `npm ci && npm run build`
4. **Publish Directory:** `dist`
5. Ortam değişkeni:

| Değişken | Değer |
| --- | --- |
| `VITE_API_URL` | Backend URL (ör. `https://achat-api.onrender.com`) |

6. **Redirects/Rewrites** (SPA için):

| Source | Destination |
| --- | --- |
| `/*` | `/index.html` |

7. Deploy → frontend URL’ini al (ör. `https://achat-web.onrender.com`)

### Adım 5 — CORS bağlantısı

Render backend servisinde `CLIENT_ORIGIN` değerini frontend URL’in yap:

```
CLIENT_ORIGIN=https://achat-web.onrender.com
```

Kaydet → backend otomatik yeniden deploy olur.

### Adım 6 — Demo kullanıcı (isteğe bağlı)

Render backend → **Shell** sekmesi:

```bash
npm run create-user demo demo@achat.local demo1234
```

### Maliyet

| Servis | Plan | Ücret |
| --- | --- | --- |
| Neon | Free | $0 |
| Render API | Free | $0 (uyku modu var) |
| Render Static | Free | $0 |

> **Not:** Render free tier 15 dakika kullanılmazsa uyur; ilk ziyaret 30–60 sn sürebilir. Socket.IO bağlantısı uyku sonrası yeniden kurulur. Sürekli açık kalması için Render **Starter ($7/ay)** plan gerekir.

### Sorun giderme

| Sorun | Çözüm |
| --- | --- |
| DB bağlanamıyor | Neon `DATABASE_URL` doğru mu? `sslmode=require` var mı? |
| CORS hatası | `CLIENT_ORIGIN` frontend URL ile birebir aynı mı? |
| Mesaj gitmiyor | `VITE_API_URL` backend URL’i mi? Frontend’i yeniden deploy et |
| 404 sayfa yenileme | Static site’ta `/* → /index.html` rewrite eklendi mi? |
