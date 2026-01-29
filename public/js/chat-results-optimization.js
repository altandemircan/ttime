// ============================================================
// CHAT RESULTS OPTIMIZATION
// triptime.ai - Result Page Design Enhancement
// ============================================================
// NOT: Bu dosya, mainscript.js'deki showResults() fonksiyonundan
// SONRA çalıştırılmalıdır. (Örn: </head> kapanışından önce)

(function initChatResultsOptimization() {
    'use strict';

    // === 1. İNLİNE STİL EKLE ===
    const optimizationStyles = document.createElement('style');
    optimizationStyles.id = 'tt-chat-results-optimization';
    optimizationStyles.textContent = `
        /* ============================================================
           SCROLL-SNAP & DAY CARD OPTIMIZATION
           ============================================================ */

        /* Sonuç container'ı */
        .survey-results {
            padding: 0 !important;
            margin: 0 !important;
        }

        .sect {
            padding: 0 !important;
            margin: 0 !important;
        }

        /* === SCROLL-SNAP CONTAINER === */
        .accordion-list {
            list-style: none;
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            gap: 0;
            scroll-snap-type: y mandatory;
            scroll-behavior: smooth;
        }

        /* === HER GÜN KARTINDA SNAP === */
        .day-item {
            scroll-snap-align: start;
            scroll-snap-stop: always;
            margin: 0;
            padding: 0;
            break-inside: avoid;
        }

        /* ============================================================
           MOBİL OPTIMIZASYON - 1 GÜN FULL SCREEN
           ============================================================ */
        @media (max-width: 768px) {
            .survey-results {
                padding: 0 !important;
                margin: 0 !important;
            }

            .sect {
                padding: 0 !important;
                margin: 0 !important;
            }

            /* Mobilde accordion-list tam ekran olsun */
            .accordion-list {
                height: 100vh;
                overflow-y: scroll;
                overflow-x: hidden;
                scroll-snap-type: y mandatory;
                scroll-padding-top: 0;
            }

            /* Her gün tam sayfa yüksekliğinde olsun */
            .day-item {
                min-height: 100vh;
                max-height: 100vh;
                scroll-snap-align: start;
                scroll-snap-stop: always;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            /* Accordion container tam uzansın */
            .accordion-container {
                height: 100%;
                display: flex;
                flex-direction: column;
            }

            /* Başlık sabit kalıp, içerik scrollable olsun */
            .accordion-label {
                flex-shrink: 0;
                z-index: 10;
            }

            /* İçerik geriye kalan yeri doldursun */
            .accordion-content {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                display: flex;
                flex-direction: column;
            }

            /* Day steps tam uzansın */
            .day-steps {
                min-height: 100%;
                display: flex;
                flex-direction: column;
            }

            /* Slider tam container'ı doldursun */
            .splide {
                flex: 1;
                display: flex;
                flex-direction: column;
                padding: 10px 12px;
            }

            .splide__track {
                flex: 1;
                display: flex;
                align-items: center;
            }

            .splide__list {
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Step card'lar slider içinde optimal boyut */
            .splide__slide {
                height: auto;
                display: flex;
            }

            .steps {
                width: 100%;
                max-width: 100%;
                margin: 0 auto;
            }

            /* Mobilede step visual daha büyük olsun */
            .steps .visual {
                height: 200px;
                min-height: 200px;
            }
        }

        @media (max-width: 480px) {
            /* Çok küçük ekranlarda daha kompakt */
            .day-item {
                min-height: 100vh;
                max-height: 100vh;
            }

            .accordion-label {
                padding: 10px 12px;
                font-size: 0.9rem;
            }

            .steps .visual {
                height: 180px;
                min-height: 180px;
            }

            .steps .info {
                padding: 8px 10px;
            }

            .item_action {
                padding: 8px 10px;
            }
        }

        /* Accordion container */
        .accordion-container {
            margin: 0;
            padding: 0;
        }

        /* Gün başlığı */
        .accordion-label {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: linear-gradient(135deg, #f5f5f5 0%, #f9f9f9 100%);
            font-weight: 700;
            font-size: 0.95rem;
            color: #1a1a1a;
            cursor: pointer;
            margin: 0;
            border-bottom: 1px solid #e8e8e8;
            user-select: none;
            transition: background 0.2s ease;
        }

        .accordion-label:hover {
            background: linear-gradient(135deg, #f0f0f0 0%, #f5f5f5 100%);
        }

        /* Açık/kapanır arrow */
        .accordion-label .accordion-arrow {
            width: 18px;
            height: 18px;
            transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
        }

        /* Accordion açık iken arrow rotasyonu */
        .day-item input[type="checkbox"]:checked ~ .accordion-label .accordion-arrow {
            transform: rotate(180deg);
        }

        /* === ACCORDION CONTENT === */
        .accordion-content {
            margin: 0;
            padding: 0;
            background: #fafafa;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease, padding 0.3s ease;
        }

        /* Checkbox ile açılı state */
        .day-item input[type="checkbox"]:checked ~ .accordion-content {
            padding: 8px 0;
            max-height: 5000px;
        }

        /* Hidden checkbox */
        .accordion-toggle {
            display: none;
        }

        /* === DAY STEPS CONTAINER === */
        .day-steps {
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
        }

        /* === SPLIDE SLIDER === */
        .splide {
            padding: 8px 12px;
            margin: 0;
            background: #fafafa;
        }

        .splide__track {
            margin: 0;
            padding: 0;
        }

        .splide__list {
            gap: 12px;
            padding: 0;
            margin: 0;
        }

        .splide__slide {
            padding: 0;
            margin: 0;
            height: auto;
        }

        /* === STEP CARD (İyileştirilmiş) === */
        .steps {
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 100%;
            background: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            transition: box-shadow 0.2s ease;
        }

        .steps:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }

        /* Visual (Resim) */
        .steps .visual {
            height: 160px;
            overflow: hidden;
            position: relative;
            flex-shrink: 0;
            background: #f0f0f0;
        }

        .steps .visual img.check {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        /* Info Section */
        .steps .info {
            padding: 8px 10px;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 3px;
            min-height: 0;
        }

        /* Title */
        .steps .title {
            font-size: 0.95rem;
            font-weight: 600;
            line-height: 1.2;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            word-break: break-word;
        }

        /* Title içindeki SVG link */
        .steps .title a {
            display: inline-flex;
            margin-left: 4px;
            vertical-align: middle;
            color: #8a4af3;
            text-decoration: none;
            transition: opacity 0.2s;
        }

        .steps .title a:hover {
            opacity: 0.7;
        }

        .steps .title svg {
            width: 14px;
            height: 14px;
            stroke: currentColor;
        }

        /* Address & Hours */
        .steps .address,
        .steps .opening_hours {
            font-size: 0.8rem;
            color: #666;
            margin: 0;
            padding: 0;
            display: flex;
            gap: 6px;
            align-items: flex-start;
            line-height: 1.3;
        }

        .steps .address img,
        .steps .opening_hours img {
            width: 14px;
            height: 14px;
            flex-shrink: 0;
            margin-top: 1px;
            opacity: 0.7;
        }

        .steps .address span,
        .steps .opening_hours span {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            word-break: break-word;
        }

        /* === ITEM ACTION BAR (Responsive) === */
        .item_action {
            padding: 8px;
            display: flex;
            gap: 8px;
            align-items: center;
            background: #fff;
            border-top: 1px solid #f0f0f0;
            flex-shrink: 0;
            flex-wrap: nowrap;
            overflow: hidden;
        }

        .item_action .change {
            display: flex;
            gap: 8px;
            flex-shrink: 0;
        }

        .item_action .change span {
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: opacity 0.2s ease;
            padding: 4px;
        }

        .item_action .change span:hover {
            opacity: 0.6;
        }

        .item_action .change span img {
            width: 18px;
            height: 18px;
            display: block;
        }

        /* === TRIP ACTION GROUP (Dropdown + Button) === */
        .trip-action-group {
            display: inline-flex;
            align-items: center;
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            transition: all 0.2s ease;
            margin-left: auto;
            flex-shrink: 0;
            gap: 0;
        }

        .trip-action-group:hover {
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            border-color: #d0d0d0;
        }

        /* Dropdown Select */
        .trip-action-group select {
            appearance: none;
            -webkit-appearance: none;
            border: none;
            background-color: transparent;
            padding: 8px 8px 8px 12px;
            font-size: 0.85rem;
            font-weight: 600;
            color: #333;
            cursor: pointer;
            outline: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 4px center;
            padding-right: 18px;
            font-family: inherit;
            min-width: 65px;
        }

        .trip-action-group select:hover {
            background-color: #f9f9f9;
        }

        /* Action Button */
        .trip-action-group .action-btn {
            border: none;
            padding: 8px 12px;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.2s ease;
            outline: none;
            height: 100%;
            font-family: inherit;
            white-space: nowrap;
            flex-shrink: 0;
        }

        /* ADD Button */
        .trip-action-group .action-btn.btn-add {
            background-color: #8a4af3;
            color: #ffffff;
            border-left: 1px solid rgba(255,255,255,0.2);
        }

        .trip-action-group .action-btn.btn-add:hover {
            background-color: #7b42db;
        }

        .trip-action-group .action-btn.btn-add img {
            filter: brightness(0) invert(1);
            width: 13px;
            height: 13px;
        }

        .trip-action-group .action-btn.btn-add svg {
            width: 13px;
            height: 13px;
            stroke: currentColor;
        }

        /* REMOVE Button */
        .trip-action-group .action-btn.btn-remove {
            background-color: #fff1f0;
            color: #dc3545;
            border-left: 1px solid #eee;
        }

        .trip-action-group .action-btn.btn-remove:hover {
            background-color: #ffe8e6;
        }

        .trip-action-group .action-btn.btn-remove svg {
            width: 13px;
            height: 13px;
            stroke: currentColor;
        }

        /* ============================================================
           RESPONSIVE OPTIMIZATIONS
           ============================================================ */

        /* MOBİL FIRST (Küçük ekranlar) */
        @media (max-width: 480px) {
            .accordion-label {
                padding: 10px 12px;
                font-size: 0.9rem;
            }

            .splide {
                padding: 10px 0;
            }

            .steps {
                border-radius: 0;
            }

            .steps .visual {
                height: 180px;
                min-height: 180px;
            }

            .steps .info {
                padding: 10px;
            }

            .steps .title {
                font-size: 0.95rem;
            }

            .steps .address,
            .steps .opening_hours {
                font-size: 0.8rem;
            }

            .item_action {
                padding: 10px;
                gap: 8px;
            }

            .item_action .change {
                gap: 8px;
            }

            .trip-action-group select {
                font-size: 0.8rem;
                min-width: 60px;
            }

            .trip-action-group .action-btn {
                font-size: 0.75rem;
                padding: 8px 10px;
            }
        }

        /* TABLET (768px ve üzeri) */
        @media (min-width: 769px) {
            .accordion-label {
                padding: 10px 14px;
                font-size: 0.95rem;
            }

            .splide {
                padding: 8px 12px;
            }

            .steps {
                border-radius: 8px;
            }

            .steps .visual {
                height: 160px;
            }

            .steps .info {
                padding: 8px 10px;
            }

            .steps .title {
                font-size: 0.95rem;
            }

            .steps .address,
            .steps .opening_hours {
                font-size: 0.8rem;
            }

            .item_action {
                padding: 8px;
                gap: 8px;
            }

            .trip-action-group select {
                font-size: 0.85rem;
            }

            .trip-action-group .action-btn {
                font-size: 0.8rem;
            }
        }

        /* ============================================================
           DARK MODE SUPPORT
           ============================================================ */
        @media (prefers-color-scheme: dark) {
            .accordion-label {
                background: linear-gradient(135deg, #2a2a2a 0%, #333 100%);
                color: #e0e0e0;
                border-bottom-color: #444;
            }

            .accordion-label:hover {
                background: linear-gradient(135deg, #333 0%, #3a3a3a 100%);
            }

            .accordion-content {
                background: #1f1f1f;
            }

            .steps {
                background: #2a2a2a;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }

            .steps .info {
                background: #2a2a2a;
            }

            .steps .title {
                color: #e0e0e0;
            }

            .steps .address,
            .steps .opening_hours {
                color: #b0b0b0;
            }

            .item_action {
                background: #2a2a2a;
                border-top-color: #444;
            }

            .trip-action-group {
                background: #2a2a2a;
                border-color: #444;
            }

            .trip-action-group select {
                color: #e0e0e0;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23e0e0e0' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
            }

            .trip-action-group select:hover {
                background-color: #333;
            }

            .trip-action-group .action-btn.btn-add {
                background-color: #8a4af3;
                color: white;
            }

            .trip-action-group .action-btn.btn-remove {
                background-color: #3e2a2a;
                color: #ef5350;
            }
        }
    `;

    document.head.appendChild(optimizationStyles);

    // === 2. FIXED NOTIFICATION BADGE ===
    function initFixedBadge() {
        const menuCount = document.getElementById('menu-count');
        if (!menuCount) return;

        // Badge'i fixed yap
        Object.assign(menuCount.style, {
            position: 'fixed',
            top: '12px',
            right: '68px',
            zIndex: '10000',
            backgroundColor: '#8a4af3',
            color: 'white',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: '700',
            boxShadow: '0 2px 8px rgba(138, 74, 243, 0.4)',
            animation: 'badgePulse 2s infinite'
        });

        // Badge pulse animation
        const badgeAnimation = document.createElement('style');
        badgeAnimation.textContent = `
            @keyframes badgePulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
        `;
        document.head.appendChild(badgeAnimation);
    }

    // === 3. ACCORDION TOGGLE LOGIC + MOBİL FULL-SCREEN ===
    function initAccordionToggle() {
        document.addEventListener('change', function(e) {
            if (e.target && e.target.classList.contains('accordion-toggle')) {
                const dayItem = e.target.closest('.day-item');
                if (dayItem && window.innerWidth <= 768) {
                    // Mobilde açılan gün otomatik kaydırsın
                    setTimeout(() => {
                        dayItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                }
            }
        });

        // Tüm gunleri default açık yap (expanded state)
        document.querySelectorAll('.accordion-toggle').forEach(checkbox => {
            checkbox.checked = true;
        });
    }

    // === 4. SPLIDE MOBİLE OPTIMIZASYON + SNAP ===
    function optimizeSplideSliders() {
        document.querySelectorAll('.splide').forEach(slider => {
            // Mount kontrolü
            if (!slider._splideInstance) return;

            const instance = slider._splideInstance;
            const isMobile = window.innerWidth <= 768;

            if (isMobile) {
                // MOBİLDE: Tek item, full genişlik, snap
                instance.options.perPage = 1;
                instance.options.gap = 0;
                instance.options.padding = { left: 0, right: 0 };
                instance.options.arrows = false;  // Okları gizle
                instance.options.pagination = false;  // Pagination gizle
                instance.options.drag = true;
                instance.options.type = 'slide';
                instance.refresh();
            } else {
                // DESKTOP: Multiple items
                instance.options.perPage = Math.max(1, Math.floor(window.innerWidth / 320));
                instance.options.gap = '12px';
                instance.options.arrows = true;
                instance.options.pagination = false;
                instance.refresh();
            }
        });
    }

    // === İNİTİYALİZASYON ===
    document.addEventListener('DOMContentLoaded', () => {
        initFixedBadge();
        initAccordionToggle();
        optimizeSplideSliders();

        // Window resize dinle
        window.addEventListener('resize', () => {
            optimizeSplideSliders();
        });
    });

    // Eğer DOM zaten hazırsa hemen çalıştır
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initFixedBadge();
            initAccordionToggle();
        });
    } else {
        initFixedBadge();
        initAccordionToggle();
    }

})();