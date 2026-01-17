document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('circleVideo');
    const icon  = document.querySelector('.sound-icon');

    if (!video) return;

    let playOnceMode = false;

    // Başlangıç: sessiz + loop
    video.muted = true;
    video.loop = true;

    // ZAMAN KONTROLÜ (son 1 saniyeyi kes)
    video.addEventListener('timeupdate', () => {
        if (!video.duration) return;

        const cutTime = video.duration - 1;

        // PLAY MODE: 1 kez çal, erken bitir
        if (playOnceMode && video.currentTime >= cutTime) {
            playOnceMode = false;

            video.muted = true;
            video.loop = true;
            video.currentTime = 0;
            video.play();

            if (icon) icon.src = '/img/mic_mute.svg';
        }

        // LOOP MODE: sona girmeden başa sar
        if (!playOnceMode && video.currentTime >= cutTime) {
            video.currentTime = 0;
        }
    });

    // PLAY / MUTE BUTONU
    window.toggleSound = function () {

        // MUTE → PLAY
        if (video.muted) {
            playOnceMode = true;

            video.loop = false;
            video.muted = false;
            video.volume = 1;
            video.currentTime = 0;
            video.play();

            if (icon) icon.src = '/img/mic_play.svg';
        }
        // PLAY → MUTE
        else {
            playOnceMode = false;

            video.muted = true;
            video.loop = true;
            video.play();

            if (icon) icon.src = '/img/mic_mute.svg';
        }
    };
});