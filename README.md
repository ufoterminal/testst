# ARC Radar — Arc token screener

Salt okunur Arc token keşfi ve analizi. Güncel sürüm RadarDEX, Tolly ve Sharc'ın kendi public API'lerinden veri alır. DYOR şu anda katalog/arama kaynağıdır; fiyat/grafik entegrasyonu henüz tamamlanmadı. Diğer padler kayıt listesinde bulunsa da aktif entegrasyon sayılmaz.

## Başlatma

Node.js 22.9+ ve npm gerekir.

```powershell
npm ci
npm start
```

Varsayılan adres http://localhost:3000. Railway'de start command `npm start`; platformun PORT değişkeni kullanılır. PostgreSQL için DATABASE_URL tanımlayın. PGlite kullanırken DATA_DIR için kalıcı volume gerekir.

## Kaynak ve yük yönetimi

- RadarDEX yalnızca kendi launch kayıtları için kullanılır.
- Tolly: scope=ours, tolly=true. Sharc: chainKey=arc.
- Liste kaynak başına dakikada bir güncellenir. Tarihsel kataloglar korunur.
- Grafik/işlemler token açılınca kendi pad'inden gelir. 30 saniyelik ortak önbellek ve eşzamanlı istek birleştirme vardır.
- Ana liste son 24 saatte hacim/işlem bildiren marketlerden oluşur. Arama yerel arşivi de içerir.
- ENABLE_INDEXER varsayılan kapalıdır. Liste/grafik için zincirin geçmişini taramaz.
- Token zamanı kaynaktaki oluşturulma zamanıdır; doğrulama kaynağı API'de ayrıca belirtilir.
- Küçük fiyatlar anlamlı basamaklarla gösterilir. Bilinmeyen sayılar sıfıra çevrilmez.
- Sharc sanal rezervleri likidite olarak gösterilmez; 24 saatlik işlem sayısı yoksa toplam işlem sayısı yerine konmaz.

## API

- GET /api/screener
- GET /api/search?q=...
- GET /api/market/:address?tf=1h — token, fiyat, mumlar ve işlemler
- GET /api/launchpads
- GET /api/status
- GET /health

## Doğrulama

`npm test`: kaynak ayrımı, birim dönüşümleri, küçük fiyatlar, HTML escaping ve detay grafiği için 8 test.

Doğrulanmış kaynaklar ve kapsam: [VERIFIED-DATA-FLOW.md](VERIFIED-DATA-FLOW.md).
Eski RADARDEX-RESEARCH.md tarihsel nottur; içindeki doğrulanmamış çıkarımlar güncel raporla geçersiz kılınmıştır.
