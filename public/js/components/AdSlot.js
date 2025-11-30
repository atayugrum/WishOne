import { authService } from '../services/AuthService.js';
import { premiumModal } from './PremiumModal.js';

export class AdSlot {
    constructor(config = {}) {
        this.element = document.createElement('div');
        this.element.className = 'ad-slot glass-panel';

        this.config = {
            provider: 'mock', // Default to mock for now
            slotId: '000000',
            width: '100%',
            height: '250px', // Default height
            ...config
        };
        this.render();
    }

    render() {
        if (authService.isPremium) {
            this.element.style.display = 'none';
            return;
        }

        this.element.style.padding = '16px';
        this.element.style.textAlign = 'center';
        this.element.style.display = 'flex';
        this.element.style.flexDirection = 'column';
        this.element.style.alignItems = 'center';
        this.element.style.gap = '8px';

        // 1. Header
        const header = document.createElement('div');
        header.style.width = '100%';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.fontSize = '0.7rem';
        header.style.color = 'var(--text-tertiary)';

        header.innerHTML = `
            <span>SPONSORED</span>
            <span class="remove-ads-link" style="cursor:pointer; color:var(--accent-color);">Remove Ads</span>
        `;
        header.querySelector('.remove-ads-link').onclick = () => premiumModal.open();
        this.element.appendChild(header);

        // 2. Ad Content
        const content = document.createElement('div');
        content.style.width = '100%';
        content.style.minHeight = this.config.height;

        if (this.config.provider === 'adsense') {
            // Real AdSense Code
            const ins = document.createElement('ins');
            ins.className = 'adsbygoogle';
            ins.style.display = 'block';
            ins.setAttribute('data-ad-client', 'ca-pub-0000000000000000'); // Replace when approved
            ins.setAttribute('data-ad-slot', this.config.slotId);
            ins.setAttribute('data-ad-format', 'auto');
            ins.setAttribute('data-full-width-responsive', 'true');
            content.appendChild(ins);

            try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { }
        } else {
            // Mock / Placeholder Mode
            content.style.background = 'rgba(0,0,0,0.05)';
            content.style.border = '2px dashed rgba(0,0,0,0.1)';
            content.style.borderRadius = '8px';
            content.style.display = 'flex';
            content.style.alignItems = 'center';
            content.style.justifyContent = 'center';
            content.style.color = 'var(--text-tertiary)';
            content.style.fontSize = '0.9rem';
            content.innerText = 'Ad Space (Mock)';
        }

        this.element.appendChild(content);
    }

    getElement() {
        return this.element;
    }
}