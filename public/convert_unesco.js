const fs = require('fs');
const path = require('path');

// Dosya yolları
const xmlPath = path.join(__dirname, 'unesco_world_heritage.xml');
const outputPath = path.join(__dirname, 'public', 'js', 'unesco_data.js');

try {
    console.log("Dosya okunuyor...");
    const xmlContent = fs.readFileSync(xmlPath, 'utf8');
    
    // Regex ile verileri ayıkla
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
            // İsim temizliği (HTML taglerini kaldır)
            let name = siteMatch[1].replace(/<[^>]*>?/gm, '').trim();
            // İsim çok uzunsa parantezden sonrasını kes (Opsiyonel, temizlik için)
            name = name.split('(')[0].trim();

            let countryCode = isoMatch ? isoMatch[1].split(',')[0].trim().toUpperCase() : 'XX';

            cleanData.push({
                name: name,
                lat: parseFloat(latMatch[1]),
                lon: parseFloat(lonMatch[1]),
                country_code: countryCode,
                type: 'unesco'
            });
        }
    }

    // window.UNESCO_DATA değişkenine ata
    const fileContent = `window.UNESCO_DATA = ${JSON.stringify(cleanData, null, 2)};`;
    
    // Eğer public klasörü yoksa oluştur
    if (!fs.existsSync(path.join(__dirname, 'public'))) {
        fs.mkdirSync(path.join(__dirname, 'public'));
    }

    fs.writeFileSync(outputPath, fileContent);
    console.log(`✅ BAŞARILI: ${cleanData.length} lokasyon 'public/unesco_data.js' dosyasına kaydedildi.`);

} catch (error) {
    console.error("❌ HATA:", error.message);
    console.log("Lütfen 'unesco_world_heritage.xml' dosyasının ana dizinde olduğundan emin olun.");
}