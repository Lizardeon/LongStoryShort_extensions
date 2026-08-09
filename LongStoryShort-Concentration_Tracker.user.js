// ==UserScript==
// @name         LongStoryShort - Concentration Tracker
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  "К" для концентрации
// @match        https://longstoryshort.app/characters/digital/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'dnd_active_concentration_spell';
    const PURPLE_COLOR = '#8350d8';

    const style = document.createElement('style');
    style.innerHTML = `
        /* Переопределяем только интерактивность и цвета, сохраняя исходную верстку */
        .spell-tag_concentration {
            cursor: pointer !important;
            transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease !important;
            user-select: none !important;
            box-sizing: border-box !important;
        }
        .spell-tag_concentration:hover {
            color: ${PURPLE_COLOR} !important;
            border-color: ${PURPLE_COLOR} !important;
        }
        /* Активное состояние тега "К" */
        .spell-tag_concentration.conc-active {
            background-color: ${PURPLE_COLOR} !important;
            color: #ffffff !important;
            border-color: ${PURPLE_COLOR} !important;
            font-weight: 600 !important;
            box-shadow: 0 0 6px rgba(131, 80, 216, 0.4) !important;
        }
        /* Подсветка карточки заклинания */
        .spell-compact {
            transition: border-color 0.2s ease, background-color 0.2s ease !important;
        }
        .spell-compact.has-concentration-active {
            border-left: 4px solid ${PURPLE_COLOR} !important;
            background-color: rgba(131, 80, 216, 0.06) !important;
        }
    `;
    document.head.appendChild(style);

    function getSpellId(wrapperAnchor) {
        if (!wrapperAnchor) return null;
        const href = wrapperAnchor.getAttribute('href') || '';
        const match = href.match(/[?&]spell=([^&]+)/);
        return match ? match[1] : wrapperAnchor.textContent.trim();
    }

    function updateConcentrationUI() {
        const activeSpellId = localStorage.getItem(STORAGE_KEY);

        document.querySelectorAll('.spell-tag_concentration').forEach(tag => {
            const spellId = tag.dataset.spellId;
            const spellCard = tag.closest('.spell-compact');

            if (spellId && spellId === activeSpellId) {
                tag.classList.add('conc-active');
                if (spellCard) spellCard.classList.add('has-concentration-active');
            } else {
                tag.classList.remove('conc-active');
                if (spellCard) spellCard.classList.remove('has-concentration-active');
            }
        });
    }

    function toggleConcentration(spellId) {
        const currentActive = localStorage.getItem(STORAGE_KEY);
        if (currentActive === spellId) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, spellId);
        }
        updateConcentrationUI();
    }

    function initTags() {
        const concentrationTags = document.querySelectorAll('.spell-tag_concentration');

        concentrationTags.forEach(tag => {
            if (tag.dataset.concInit) return;

            const spellCard = tag.closest('.spell-compact');
            if (!spellCard) return;

            const wrapper = spellCard.querySelector('a.spell-compact__wrapper');
            const spellId = getSpellId(wrapper);
            if (!spellId) return;

            tag.dataset.spellId = spellId;
            tag.dataset.concInit = 'true';

            tag.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleConcentration(spellId);
            });
        });

        updateConcentrationUI();
    }

    let isScheduled = false;
    const scheduleInit = () => {
        if (!isScheduled) {
            isScheduled = true;
            requestAnimationFrame(() => {
                initTags();
                isScheduled = false;
            });
        }
    };

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                scheduleInit();
                break;
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    scheduleInit();
})();
