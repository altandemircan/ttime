function typeWriter(element, text, i = 0, speed = 20) {
    if (i < text.length) {
        element.textContent = text.substring(0, i + 1);
        i++;
        setTimeout(function() {
            typeWriter(element, text, i, speed);
        }, speed);
    } else {
        hideTypingIndicator();
    }
}