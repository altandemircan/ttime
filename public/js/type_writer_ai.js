// --- YENİ EKLENEN AI VE UTILITY FONKSİYONLARI ---

function onCitySelected(city) {
    let planAktif = false;
    window.lastTripAIInfo = null;
    insertTripAiInfo(() => {
        if (!planAktif) {
            // insertTripPlan(city); // Bu fonksiyon projenizde varsa kullanın, yoksa kaldırın
            planAktif = true;
        }
    });
}

function extractFirstJson(str) {
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}');
    if (start !== -1) {
        return str.substring(start, (end !== -1 && end > start) ? end + 1 : undefined);
    }
    return "";
}

window.typeWriterEffect = function(element, text, speed, callback) {
    let i = 0;
    element.textContent = "";
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else {
            if (callback) callback();
        }
    }
    type();
}

