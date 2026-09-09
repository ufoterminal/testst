# Doğrulanan veri akışı

9 Eylül 2026 tarihinde yayımlanan frontend kodları ve canlı JSON yanıtları incelendi. Bu not, önceki RADARDEX-RESEARCH.md içindeki doğrulanmamış mimari çıkarımların yerine geçer.

## RadarDEX

[RadarDEX frontend](https://radardex.pro/) doğrudan kendi API'sini kullanıyor. Görülen uçlar:

- Liste: /tokens?sort=volume24&dir=desc&limit=500&window=24h
- Kendi launchları: aynı sorguda launchpad=radar
- Arama: /tokens?q=...; üst listedeki sonuçlardan bağımsız
- Detay: /token/{address}
- Grafik: /token/{address}/chart?tf=3600&limit=1000
- İşlemler: /token/{address}/swaps?limit=60
- Genel istatistikler: /stats

Liste 15 saniye, açık detay 8 saniye, genel istatistikler 60 saniyede yenileniyor. Liste/detay yenilemesi görünür sekmeye bağlı. Grafik lightweight-charts 4.1.3 kullanıyor. Bu gözlemler frontend davranışını kanıtlar; RadarDEX'in sunucu içindeki indeksleme mimarisini kanıtlamaz.

Genel /tokens yanıtı Tolly ve diğer padleri de içeriyor. Bu projede Radar listesi launchpad=radar filtresi, launch kaydı eşleşmesi ve launched kontrolüyle sınırlandı. Token detayında aynı aidiyet tekrar kontrol ediliyor.

## Doğrudan pad kaynakları

| Kaynak | Liste | Grafik | İşlemler |
|---|---|---|---|
| [Tolly API](https://api.tollylabs.com/tokens?scope=ours&limit=2) | /tokens?scope=ours | /candles?token=ADDRESS&tf=1h | /swaps?token=ADDRESS |
| [Sharc API](https://sharc.fun/api/tokens) | /api/tokens | /api/tokens/ADDRESS/candles?interval=3600 | /api/tokens/ADDRESS/trades |
| [DYOR Arc API](https://arc-api-production-ef9c.up.railway.app/api/arc/v1/tokens?limit=2) | /api/arc/v1/tokens | Henüz bağlanmadı | Henüz bağlanmadı |

Tolly listesinde tolly=true kontrolü yapılır; scope=all kullanılmaz. Sayfalama yanıtı 200 kayıtta kesildiği için sınırlı ek sayfalar alınır. Sharc'ta chainKey=arc kontrol edilir.

[Sharc yapılandırması](https://sharc.fun/api/config/arc) factory adresini 0x2b2b76d365c76a9226d436746746bcf62cdf5634 olarak veriyor. Sanal curve rezervleri gerçek likidite kabul edilmez.

Sharc priceE18 / 10^18; marketCap ve volume24h / 10^6; değişimler basis-point / 100 olarak dönüştürülür. tradesCount ve tradersCount toplam sayılardır, 24 saat sütunlarında kullanılmaz.

## Çalışan proje davranışı

Liste backend'de dakikada bir kaynak başına güncellenir. Detay istekleri 30 saniye önbellekte tutulur, eşzamanlı aynı istek birleştirilir. Radar launch arşivi 15 dakika önbelleğe alınır. Tarayıcı listeyi ve açık detayı 15 saniyede bir, yalnızca sekme görünürken yeniler.

ENABLE_INDEXER varsayılan olarak kapalıdır. Güncel liste ve grafikler için zincir taraması gerekmiyor. Eski indexer deneysel olarak duruyor; üretimde açılmamalı.

Ana listede son 24 saatte hacmi veya işlemi bildirilen kaynak kayıtları gösterilir. Arama yerel arşivi de tarar; tüm Arc geçmişinin eksiksiz kapsandığı iddia edilmez. DYOR şimdilik katalog/arama düzeyinde; diğer registry girdileri entegrasyonun aktif olduğu anlamına gelmez.

## Canlı kontroller

- RadarDEX / COOL: 500 mum, 60 işlem; fiyat ve token zamanı dolu.
- Tolly / TOLLY: 500 mum, 60 işlem; kendi API'sinden fiyat ve zaman.
- Sharc / SHARC: 167 mum, 60 işlem; kendi API'sinden fiyat ve zaman.
- Birim, chain/aidiyet filtreleri ve arayüz render kontrolleri: 8 test geçti.

Test sayıları canlı duruma bağlı değişebilir. Bu sonuçlar yerel kod içindir; Railway deploy'u yapılmadı.
