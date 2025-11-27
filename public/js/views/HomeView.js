import { firestoreService } from '../services/FirestoreService.js';
import { authService } from '../services/AuthService.js';
import { CurrencyService } from '../services/CurrencyService.js';
import { AddItemModal } from '../components/addItemModal.js';
import { AdSlot } from '../components/AdSlot.js';
import { CATEGORIES } from '../config/categories.js';
import { i18n } from '../services/LocalizationService.js';

let addItemModal = null;
let currentView = 'grid'; // State: 'grid' or 'timeline'

// Helper: Days Left
function getCountdown(dateString) {
    if (!dateString) return null;
    const target = new Date(dateString);
    if (isNaN(target.getTime())) return null; // Handle Invalid Date

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: "Overdue", class: "tag-overdue", days: diffDays };
    if (diffDays === 0) return { text: "Today!", class: "tag-urgent", days: 0 };
    if (diffDays <= 7) return { text: `${diffDays} days left`, class: "tag-urgent", days: diffDays };
    if (diffDays <= 30) return { text: `${diffDays} days left`, class: "tag-soon", days: diffDays };

    // Better Month Logic
    const months = Math.round(diffDays / 30);
    if (months <= 1) return { text: "Next Month", class: "tag-far", days: diffDays };
    if (months >= 12) return { text: `in ${(months / 12).toFixed(1)} years`, class: "tag-far", days: diffDays };
    return { text: `in ${months} months`, class: "tag-far", days: diffDays };
}

function getWeeklySavings(price, days) {
    if (!days || days <= 0) return 0;
    const weeks = days / 7;
    if (weeks < 1) return price;
    return Math.ceil(price / weeks);
}

export const HomeView = {
    skeletonTemplate: `
        <article class="glass-panel card skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-text title"></div>
            <div class="skeleton-text meta"></div>
        </article>
    `,

    render: async () => {
        if (!addItemModal) addItemModal = new AddItemModal(() => HomeView.loadData());

        window.openAddModal = () => addItemModal.open();

        window.handleDeleteItem = async (itemId) => {
            if (confirm("Remove this wish?")) {
                const card = document.querySelector(`[data-id="${itemId}"]`);
                if (card) { card.style.transform = 'scale(0.9)'; card.style.opacity = '0'; }
                await firestoreService.deleteItem(itemId);
                HomeView.loadData();
            }
        };

        window.handleMoveToCloset = async (itemId) => {
            const card = document.querySelector(`[data-id="${itemId}"]`);
            if (card) { card.style.transform = 'scale(1.1)'; card.style.opacity = '0'; }
            setTimeout(async () => {
                await firestoreService.markAsOwned(itemId);
                HomeView.loadData();
            }, 300);
        };

        // NEW: Toggle Handler
        window.setView = (mode) => {
            currentView = mode;
            HomeView.loadData();
            // Update buttons visually
            document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(`btn-${mode}`).classList.add('active');
        };

        setTimeout(() => HomeView.loadData(), 0);

        return `
            <!-- Side Banners (Desktop Only) -->
            ${!authService.isPremium ? `
                <div class="ad-side-banner left">
                    <span class="ad-badge">Sponsored</span>
                    <h3>WishOne Premium</h3>
                    <p>Remove ads & unlock more!</p>
                    <button class="btn-primary btn-sm" onclick="authService.upgradeToPremium().then(() => window.location.reload())" style="font-size:0.8rem; padding:8px 16px;">Upgrade</button>
                </div>
                <div class="ad-side-banner right">
                    <span class="ad-badge">Ad</span>
                    <h3>Cool Product</h3>
                    <p>Check this out!</p>
                </div>
            ` : ''}

            <div class="view-header" style="display:flex; align-items:flex-end;">
                <div>
                    <h1>${i18n.t('home.title')}</h1>
                    <p>${i18n.t('home.subtitle')}</p>
                </div>
                
                <!-- NEW: View Toggle -->
                <div class="view-toggle">
                    <button id="btn-grid" class="toggle-btn active" onclick="window.setView('grid')" title="Grid View">⊞</button>
                    <button id="btn-timeline" class="toggle-btn" onclick="window.setView('timeline')" title="Timeline View">☰</button>
                </div>
            </div>

            <!-- Financial Dashboard -->
            <div id="finance-dashboard" class="glass-panel dashboard-widget" style="display:none;">
                 <div class="stat-box">
                    <span class="stat-label">${i18n.t('dashboard.wishes')}</span>
                    <span class="stat-value" id="total-count">0</span>
                 </div>
                 <div class="stat-divider"></div>
                 
                 <div class="stat-box">
                    <span class="stat-label">${i18n.t('dashboard.value')}</span>
                    <div class="stat-value-group">
                        <span class="stat-value" id="total-value-try">0₺</span>
                        <span class="stat-subvalue" id="total-value-eur" style="font-size: 0.9rem; color: var(--text-secondary);">0€</span>
                    </div>
                 </div>
                 
                 <div class="stat-divider"></div>
                 
                 <div class="stat-box">
                    <span class="stat-label">6-Month Goal</span>
                    <span class="stat-value" id="weekly-save">0₺/wk</span>
                 </div>
            </div>

            <!-- Content Area -->
            <div id="content-area">
                <div class="masonry-grid">
                    ${HomeView.skeletonTemplate.repeat(4)}
                </div>
            </div>
            
            <button class="fab-add" onclick="window.openAddModal()">+</button>
        `;
    },

    loadData: async () => {
        const container = document.getElementById('content-area');
        const dashboard = document.getElementById('finance-dashboard');

        if (!container) return;

        const user = authService.currentUser;
        if (!user) {
            container.innerHTML = `<div class="empty-state">Login required.</div>`;
            return;
        }

        try {
            const [items, closetItems] = await Promise.all([
                firestoreService.getWishlist(user.uid),
                firestoreService.getCloset(user.uid)
            ]);

            // Update Dashboard
            let totalValueTRY = 0;
            items.forEach(item => totalValueTRY += CurrencyService.convert(item.price, item.currency, 'TRY'));

            const totalValueEUR = CurrencyService.convert(totalValueTRY, 'TRY', 'EUR');
            const weeklySave = Math.ceil(totalValueTRY / 26); // 6 months = 26 weeks

            if (items.length > 0 || closetItems.length > 0) {
                dashboard.style.display = 'flex';
                document.getElementById('total-count').textContent = items.length;

                document.getElementById('total-value-try').textContent = CurrencyService.format(totalValueTRY, 'TRY');
                document.getElementById('total-value-eur').textContent = CurrencyService.format(totalValueEUR, 'EUR');

                document.getElementById('weekly-save').textContent = `${CurrencyService.format(weeklySave, 'TRY')}`;
            } else {
                dashboard.style.display = 'none';
            }

            if (items.length === 0) {
                container.innerHTML = `<div class="empty-state">${i18n.t('home.empty')}</div>`;
                return;
            }

            // --- RENDER LOGIC SWITCH ---
            if (currentView === 'grid') {
                let gridHtml = '';
                items.forEach((item, index) => {
                    gridHtml += HomeView.renderCard(item);
                    // Inject Ad every 5 items for free users
                    if (!authService.isPremium && (index + 1) % 5 === 0) {
                        const ad = new AdSlot();
                        gridHtml += `<div class="ad-wrapper">${ad.getElement().outerHTML}</div>`;
                    }
                });
                container.innerHTML = `<div class="masonry-grid">` + gridHtml + `</div>`;

                // Re-attach events for ads
                container.querySelectorAll('.ad-slot #btn-upgrade').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm("Upgrade to Premium for $4.99?")) {
                            await authService.upgradeToPremium();
                            window.location.reload();
                        }
                    });
                });

            } else {
                container.innerHTML = HomeView.renderTimeline(items);
            }

        } catch (error) {
            console.error("HomeView Load Error:", error);
        }
    },

    // Helper: Render Single Card
    renderCard: (item) => {
        const catConfig = CATEGORIES[item.category] || CATEGORIES['Other'];
        const icon = catConfig ? catConfig.icon : '📦';
        const subText = item.subcategory ? `• ${item.subcategory}` : '';
        const timeData = getCountdown(item.targetDate);
        let timeBadge = '';
        let savingsText = '';

        if (timeData) {
            timeBadge = `<div class="card-overlay-badge"><span class="time-tag ${timeData.class}">⏳ ${timeData.text}</span></div>`;
            if (item.price > 0 && timeData.days > 0) {
                const weekly = getWeeklySavings(item.price, timeData.days);
                if (weekly > 0) {
                    const savingsTextContent = i18n.t('savings.weekly').replace('{amount}', `${weekly} ${item.currency}`);
                    savingsText = `<div class="savings-hint">${savingsTextContent}</div>`;
                }
            }
        }

        // Discount Badge Logic
        let discountBadge = '';
        if (item.onSale && item.originalPrice && item.price < item.originalPrice) {
            const discount = Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100);
            if (discount > 0) {
                discountBadge = `<div class="discount-badge">-${discount}%</div>`;
            }
        }

        return `
            <article class="glass-panel card" data-id="${item.id}">
                <button class="card-action-btn delete-btn" onclick="window.handleDeleteItem('${item.id}')">&times;</button>
                <button class="card-action-btn closet-btn" onclick="window.handleMoveToCloset('${item.id}')">✔</button>
                <div class="card-img-container">
                    ${timeBadge}
                    ${discountBadge}
                    <img src="${item.imageUrl}" class="card-img" onerror="this.src='https://placehold.co/600x400'">
                </div>
                <div class="card-content">
                    <h3>${item.title}</h3>
                    ${savingsText}
                    <div class="card-meta">
                        <span class="tag">${icon} ${item.category} ${subText}</span>
                        <span class="price">${item.price} ${item.currency}</span>
                    </div>
                </div>
            </article>
        `;
    },

    // Helper: Render Timeline Structure
    renderTimeline: (items) => {
        // 1. Sort items by Date (Someday last)
        const sortedItems = [...items].sort((a, b) => {
            if (!a.targetDate) return 1;
            if (!b.targetDate) return -1;
            return new Date(a.targetDate) - new Date(b.targetDate);
        });

        // 2. Group items by Month
        const groups = {};
        sortedItems.forEach(item => {
            let key = i18n.t('timeline.someday');
            if (item.targetDate) {
                const date = new Date(item.targetDate);
                key = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            }
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        // 3. Build HTML
        let html = `<div class="timeline-container">`;

        for (const [groupName, groupItems] of Object.entries(groups)) {
            html += `
                <div class="timeline-group">
                    <div class="timeline-header">${groupName}</div>
                    ${groupItems.map(item => `
                        <div class="timeline-item">
                            ${HomeView.renderCard(item)}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        html += `</div>`;
        return html;
    }
};