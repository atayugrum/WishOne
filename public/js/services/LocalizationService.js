import { TRANSLATIONS } from '../config/locales.js';

export class LocalizationService {
    constructor() {
        this.lang = localStorage.getItem('wishone_lang') || 'en';
        this.observers = [];
    }

    // Get a specific string (e.g., 'home.title')
    t(key) {
        const keys = key.split('.');
        let value = TRANSLATIONS[this.lang];
        
        for (const k of keys) {
            value = value[k];
            if (!value) return key; // Fallback to key if missing
        }
        return value;
    }

    setLanguage(lang) {
        if (lang !== 'en' && lang !== 'tr') return;
        this.lang = lang;
        localStorage.setItem('wishone_lang', lang);
        
        // Notify all views to re-render
        this.notify();
    }

    toggle() {
        const newLang = this.lang === 'en' ? 'tr' : 'en';
        this.setLanguage(newLang);
    }

    // Simple Event Bus to trigger re-renders
    subscribe(callback) {
        this.observers.push(callback);
    }

    notify() {
        this.observers.forEach(cb => cb(this.lang));
        // Also reload the page to make it easy for now (cleanest way to refresh all views)
        window.location.reload();
    }
}

export const i18n = new LocalizationService();