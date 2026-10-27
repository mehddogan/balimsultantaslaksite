# Balım Sultan Muhabbeti — site

GitHub Pages ile yayınlanan, derleme gerektirmeyen bir site.

## Yönetici paneli
1. https://app.pagescms.org adresine gidin ve **Sign in with GitHub** ile girin.
2. İlk girişte Pages CMS uygulamasının bu depoya (`balimsultantaslaksite`) erişmesine izin verin.
3. Depoyu seçin. Solda bölümler görünür: Nefesler ve Deyişler, Şerhler, Sözlük, Zakir Belgeseli, Kayıtlar, Fotoğraflar, Albüm, Yolculuğumuz, Anılar, Hakkımızda, Ayarlar.
4. Düzenleyip **Save** deyin. Site bir iki dakika içinde güncellenir.

Fotoğraf yüklerken panel dosyaları `gorsel/` klasörüne koyar.

### Nefes sözleri
Sözler tek bir metin kutusunda durur. Her dize ayrı satırda, kıtalar arasında bir boş satır.

### Şerh yazmak
Şerhler bölümünde **Add an entry**, Nefes listesinden ilgili nefesi seçin, metni yazın. Biçim: `## Başlık`, `**kalın**`, `*italik*`, `> alıntı`, tablolar `| a | b |`.

## Dosyalar
- `data/*.json` — sitedeki bütün metinler (panel bunları düzenler)
- `data/serhler/*.md` — şerhler
- `gorsel/` — fotoğraflar, illüstrasyonlar, yolculuk kareleri
- `video/` — siteye gömülü videolar. Büyük videoları YouTube'a yükleyip bağlantısını Kayıtlar'a ekleyin; GitHub 100 MB'tan büyük dosya kabul etmez.
- `.pages.yml` — yönetici panelinin ayarları

## Alan adı
Alan adı alındığında: depo → Settings → Pages → Custom domain.
