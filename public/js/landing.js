/* public/js/landing.js */

// Target: Friday, Dec 5, 2025 at 12:00 (Noon), Istanbul Time (UTC+3)
const TARGET_DATE = "2025-12-05T12:00:00+03:00";

const ELEMENTS = {
    days: document.getElementById('count-days'),
    hours: document.getElementById('count-hours'),
    minutes: document.getElementById('count-minutes'),
    seconds: document.getElementById('count-seconds'),
    container: document.getElementById('countdown-container'),
    actionArea: document.getElementById('action-area')
};

function updateCountdown() {
    const now = new Date().getTime();
    const launch = new Date(TARGET_DATE).getTime();
    const distance = launch - now;

    if (distance < 0) {
        handleLaunch();
        return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    if (ELEMENTS.days) ELEMENTS.days.innerText = String(days).padStart(2, '0');
    if (ELEMENTS.hours) ELEMENTS.hours.innerText = String(hours).padStart(2, '0');
    if (ELEMENTS.minutes) ELEMENTS.minutes.innerText = String(minutes).padStart(2, '0');
    if (ELEMENTS.seconds) ELEMENTS.seconds.innerText = String(seconds).padStart(2, '0');
}

function handleLaunch() {
    if (ELEMENTS.actionArea) {
        ELEMENTS.actionArea.innerHTML = `
            <div style="animation: fadeUp 0.5s ease;">
                <h3 style="margin-bottom:16px;">The Lab is Open.</h3>
                <a href="/lab" class="btn-primary btn-magic" style="display:inline-flex; text-decoration:none; padding:12px 24px; border-radius:20px; align-items:center; gap:8px;">
                    Enter App 🚀
                </a>
            </div>
        `;
    }
}

setInterval(updateCountdown, 1000);
updateCountdown();