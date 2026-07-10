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

## Deploy

Canlı ortam için PostgreSQL (Railway, Supabase, Neon vb.) kullan. `JWT_SECRET` ve `CLIENT_ORIGIN` değerlerini üretim URL'lerine göre ayarla; client build sırasında `VITE_API_URL` backend adresini göster.
