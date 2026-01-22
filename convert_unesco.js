const fs = require('fs');
const path = require('path');

// Yüklediğin dosyanın adı
const xmlPath = path.join(__dirname, 'unesco_world_heritage.xml');
const outputPath = path.join(__dirname, 'public', 'unesco_data.js'); // Public klasörüne kaydedelim

try {
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
    
    // Regex ile basit parsing (Paket kurmana gerek kalmasın diye)
    // <row>...</row> bloklarını yakala
    const rowRegex = /<row>([\s\S]*?)<\/row>/g;
    const siteRegex = /<site>(.*?)<\/site>/;
    const latRegex = /<latitude>(.*?)<\/latitude>/;
    const lonRegex = /<longitude>(.*?)<\/longitude>/;
    const isoRegex = /<iso_code>(.*?)<\/iso_code>/;
    
    let match;
    const cleanData = [];

    while ((match = rowRegex.exec(xmlContent)) !== null) {
        const rowContent = match[1];
        
        const siteMatch = rowContent.match(siteRegex);
        const latMatch = rowContent.match(latRegex);
        const lonMatch = rowContent.match(lonRegex);
        const isoMatch = rowContent.match(isoRegex);

        if (siteMatch && latMatch && lonMatch) {
            // İsimleri temizle (örn: "Göreme National Park..." -> "Göreme National Park")
            // Gereksiz HTML taglerini temizle
            let name = siteMatch[1].replace(/<[^>]*>?/gm, '').trim();
            
            // Ülke kodunu temizle (birden fazlaysa ilkini al)
            let countryCode = isoMatch ? isoMatch[1].split(',')[0].trim().toUpperCase() : 'XX';

            cleanData.push({
                name: name,
                lat: parseFloat(latMatch[1]),
                lon: parseFloat(lonMatch[1]),
                country_code: countryCode,
                type: 'unesco' // Özel tip atadık
            });
        }
    }

    // JavaScript dosyası olarak kaydet (Global değişkene ata)
    const fileContent = `window.UNESCO_DATA = ${JSON.stringify(cleanData, null, 2)};`;
    
    fs.writeFileSync(outputPath, fileContent);
    console.log(`✅ İşlem tamam! ${cleanData.length} lokasyon dönüştürüldü.`);
    console.log(`Dosya şuraya kaydedildi: ${outputPath}`);

} catch (error) {
    console.error("Hata:", error.message);
}