// mainscript.js başına veya uygun bir yere ekle:
function typeWriterEffect(element, html, speed = 16) {
    let i = 0;
    element.innerHTML = "";
    function type() {
        if (i < html.length) {
            if (html[i] === "<") {
                const close = html.indexOf(">", i);
                if (close !== -1) {
                    element.innerHTML += html.slice(i, close + 1);
                    i = close + 1;
                } else {
                    element.innerHTML += html[i++];
                }
            } else {
                element.innerHTML += html[i++];
            }
            setTimeout(type, speed);
        }
    }
    type();
}