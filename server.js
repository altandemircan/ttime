const express = require('express');
const path = require('path');
const app = express();

// 1. JSON body parser HER ŞEYİN EN BAŞINDA OLMALI
app.use(express.json());

// 2. API routerlarını ekle

const llmProxy = require('./llm-proxy');
const photogetProxy = require('./photoget-proxy');

app.use('/llm-proxy', llmProxy);
app.use('/photoget-proxy', photogetProxy);


// 3. Test endpoint (isteğe bağlı)
app.get('/test-root', (req, res) => {
    res.json({ message: 'Root test OK' });
});

// 4. Statik dosyaları public klasöründen sun
app.use(express.static(path.join(__dirname, 'public')));

// 5. SPA ise, tüm GET isteklerini index.html'e yönlendir (EN SONA KOY!)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});