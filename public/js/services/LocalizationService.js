/* public/js/services/LocalizationService.js */
import { TRANSLATIONS } from '../config/locales.js';

class LocalizationService {
    constructor() {
        this.locale = localStorage.getItem('wishone_locale') || 'en';
        this.listeners = [];
        this.dictionary = TRANSLATIONS;
    }

    setLocale(lang) {
        if (!this.dictionary[lang]) return;
        this.locale = lang;
        localStorage.setItem('wishone_locale', lang);
        this.notifyListeners();
        // Reload to apply changes across all rendered views instantly
        window.location.reload(); 
    }

    t(key) {
        const keys = key.split('.');
        let current = this.dictionary[this.locale];
        
        for (const k of keys) {
            if (current[k] === undefined) {
                console.warn(`Missing translation: ${key} (${this.locale})`);
                return key;
            }
            current = current[k];
        }
        return current;
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notifyListeners() {
        this.listeners.forEach(cb => cb(this.locale));
    }
}

export const i18n = new LocalizationService();