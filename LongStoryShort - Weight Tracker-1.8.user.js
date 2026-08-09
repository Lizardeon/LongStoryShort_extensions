// ==UserScript==
// @name         LongStoryShort - Weight Tracker
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description
// @match        https://longstoryshort.app/characters/digital/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STYLES = `
        #weight-tracker-root .digital-boxed-value__box {
            font-weight: bold;
            white-space: nowrap;
            cursor: help;
        }
        .wt-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-left: 5px;
            vertical-align: middle;
            transition: background-color 0.3s ease;
            box-shadow: 0 0 3px rgba(0, 0, 0, 0.3);
        }
        .wt-custom-tooltip {
            position: fixed;
            z-index: 9999;
            pointer-events: none;
            opacity: 0;
            transition: opacity 100ms ease, transform 100ms ease;
            transform: translateY(4px);
        }
        .wt-custom-tooltip.wt-visible {
            opacity: 1;
            transform: translateY(0);
        }
    `;

    let tooltipEl = null;

    function getOrCreateTooltip() {
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'digital-boxed-value__tooltip m_1b3c8819 mantine-Tooltip-tooltip wt-custom-tooltip';
            tooltipEl.setAttribute('role', 'tooltip');
            document.body.appendChild(tooltipEl);
        }
        return tooltipEl;
    }

    function showTooltip(target, text) {
        const tooltip = getOrCreateTooltip();
        tooltip.innerHTML = `<p class="digital__features__tooltip-p">${text}</p>`;

        const rect = target.getBoundingClientRect();

        // Временно показываем для расчета высоты/ширины
        tooltip.style.display = 'block';

        const tooltipRect = tooltip.getBoundingClientRect();

        // Размещение над элементом (или под ним, если не хватает места сверху)
        let top = rect.top - tooltipRect.height - 8;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        if (top < 10) {
            top = rect.bottom + 8;
        }

        // Ограничение по экрану по горизонтали
        left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.classList.add('wt-visible');
    }

    function hideTooltip() {
        if (tooltipEl) {
            tooltipEl.classList.remove('wt-visible');
        }
    }

    function injectStyles() {
        if (!document.getElementById('weight-tracker-styles')) {
            const style = document.createElement('style');
            style.id = 'weight-tracker-styles';
            style.textContent = STYLES;
            document.head.appendChild(style);
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function parseWeight(text) {
        let total = 0;
        const lines = text.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/(\d+(?:[\.,]\d+)?)\s*фнт(?:\s*[\*xх×]\s*(\d+))?/i);
            if (match) {
                const weight = parseFloat(match[1].replace(',', '.'));
                const qty = match[2] ? parseInt(match[2], 10) : 1;
                if (!isNaN(weight) && !isNaN(qty)) {
                    total += weight * qty;
                }
            }
        }

        return Math.round(total * 100) / 100;
    }

    function getMaxCapacity() {
        const labels = document.querySelectorAll('.digital-boxed-value__label');
        for (const label of labels) {
            if (label.textContent.includes('Грузоподъёмность')) {
                const box = label.previousElementSibling || label.parentNode.querySelector('.digital-boxed-value__box');
                if (box) {
                    const match = box.textContent.match(/(\d+)\s*\//);
                    if (match) return parseFloat(match[1]);
                }
            }
        }
        return 150;
    }

    function getEncumbranceState(current, maxCap) {
        const str = maxCap / 15;
        const t15 = Math.round(15 * str);
        const t13 = Math.round(13 * str);
        const t10 = Math.round(10 * str);
        const t8 = Math.round(8 * str);
        const t5 = Math.round(5 * str);

        if (current > t15) return { color: '#745b95', text: `Вес превышает <b>${t15} фунтов</b>: Основная скорость уменьшается до 0;<br>Вы совершаете с помехой Тесты к20, использующие Силу, Ловкость или Телосложение.` };
        if (current > t13) return { color: '#c03d38', text: `Вес превышает <b>${t13} фунтов</b>: Основная скорость уменьшается до 10 футов, если она была больше;<br>Вы совершаете с помехой Тесты к20, использующие Силу, Ловкость или Телосложение.` };
        if (current > t10) return { color: '#ee9348', text: `Вес превышает <b>${t10} фунтов</b>: Основная скорость уменьшается до 15 футов, если она была больше;<br>Вы совершаете с помехой Тесты к20, использующие Силу, Ловкость или Телосложение.` };
        if (current > t8) return { color: '#ffc000', text: `Вес превышает <b>${t8} фунтов</b>: Основная скорость уменьшается до 20 футов, если она была больше.` };
        if (current > t5) return { color: '#86a842', text: `Вес превышает <b>${t5} фунтов</b>: Основная скорость уменьшается на 5 футов.` };

        return { color: '#66bb6a', text: 'Перегруза нет' };
    }

    function createTrackerDOM() {
        const container = document.createElement('div');
        container.className = 'digital-boxed-value digital-boxed-value_label-top digital-boxed-value_no-background';
        container.id = 'weight-tracker-root';

        container.innerHTML = `
            <div class="digital-boxed-value__box">
                <span id="wt-current">0</span>&nbsp;/&nbsp;<span id="wt-max">0</span>&nbsp;фнт.
            </div>
            <span class="digital-boxed-value__label">
                Вес<span id="wt-indicator" class="wt-indicator"></span>
            </span>
        `;

        // События для вызова оригинального тултипа
        container.addEventListener('mouseenter', () => {
            const text = container.dataset.tooltipText;
            if (text) showTooltip(container, text);
        });
        container.addEventListener('mouseleave', hideTooltip);

        return container;
    }

    function updateTracker() {
        const sizeSelect = document.querySelector('.digital__slide-equipment__select');
        const sizeBox = sizeSelect ? sizeSelect.closest('.digital-boxed-value') : null;

        if (!sizeBox) return;

        let trackerRoot = document.getElementById('weight-tracker-root');
        if (!trackerRoot) {
            trackerRoot = createTrackerDOM();
            sizeBox.after(trackerRoot);
        }

        const textBlocks = document.querySelectorAll('.digital-text-block');
        let equipmentBlock = null;
        for (const block of textBlocks) {
            const btn = block.querySelector('.digital-text-block__label');
            if (btn && btn.textContent.includes('Снаряжение')) {
                equipmentBlock = block;
                break;
            }
        }

        if (!equipmentBlock) return;

        const editor = equipmentBlock.querySelector('.ProseMirror');
        if (!editor) return;

        const currentWeight = parseWeight(editor.innerText);
        const maxCapacity = getMaxCapacity();
        const state = getEncumbranceState(currentWeight, maxCapacity);

        document.getElementById('wt-current').textContent = currentWeight;
        document.getElementById('wt-max').textContent = Math.round(maxCapacity * 10) / 10;

        const indicator = document.getElementById('wt-indicator');
        if (indicator) {
            indicator.style.backgroundColor = state.color;
        }

        // Сохраняем текст состояния для кастомного тултипа
        trackerRoot.dataset.tooltipText = state.text;
    }

    const debouncedUpdate = debounce(updateTracker, 150);

    let equipmentObserver = null;

    function handleTabSwitch() {
        const slideContainer = document.querySelector('.digital__slide-equipment');
        const isVisible = slideContainer && (slideContainer.offsetWidth > 0 || slideContainer.offsetHeight > 0 || getComputedStyle(slideContainer).display !== 'none');

        if (isVisible) {
            if (!equipmentObserver) {
                updateTracker();
                equipmentObserver = new MutationObserver(debouncedUpdate);
                equipmentObserver.observe(slideContainer, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            }
        } else {
            if (equipmentObserver) {
                equipmentObserver.disconnect();
                equipmentObserver = null;
            }
            hideTooltip();
        }
    }

    function init() {
        injectStyles();

        const pageObserver = new MutationObserver(debounce(handleTabSwitch, 100));
        pageObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'aria-selected']
        });

        handleTabSwitch();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();