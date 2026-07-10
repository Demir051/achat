# achat

Discord benzeri, kendine has minimalist tasarıma sahip gerçek zamanlı sohbet uygulaması.

## Özellikler

- 🔐 Kayıt / giriş (JWT tabanlı kimlik doğrulama)
- 🏠 Sunucu oluşturma & davet kodu ile katılma
- 💬 Sunucu içi metin kanalları ve gerçek zamanlı mesajlaşma
- 📩 Kişiden kişiye özel mesajlaşma (DM) + arkadaşlık sistemi
- 🎙️ Sesli sohbet kanalları (WebRTC)
- 🖥️ Ekran paylaşımı (WebRTC)
- 🎨 Sade, minimalist ama şık koyu tema

## Teknoloji

| Katman | Teknoloji |
| --- | --- |
| Backend | Node.js, Express, Socket.IO, TypeScript |
| Veritabanı | SQLite + Prisma ORM (MongoDB dışı, ilişkisel) |
| Frontend | React, Vite, TypeScript, Zustand |
| Gerçek zamanlı | Socket.IO |
| Ses / Ekran | WebRTC (mesh) |

> Not: Veritabanı SQLite ile sıfır kurulum çalışır. Üretim için `server/prisma/schema.prisma`
> içindeki `datasource` sağlayıcısını `postgresql` olarak değiştirip `DATABASE_URL` verebilirsiniz.

## Kurulum

### 1. Backend

```bash
cd server
npm install
npm run db:push      # SQLite şemasını oluşturur
npm run dev          # http://localhost:4000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

Tarayıcıdan `http://localhost:5173` adresini açın. İki farklı tarayıcı/sekmede
farklı hesaplarla giriş yaparak sesli sohbet ve ekran paylaşımını test edebilirsiniz.
