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
        
        // [CRITICAL FIX] Prevent infinite reload loop
        // If the requested language is ALREADY the current language, do nothing.
        if (this.locale === lang) return;

        this.locale = lang;
        localStorage.setItem('wishone_locale', lang);
        this.notifyListeners();
        
        // Only reload if we actually changed the language
        window.location.reload(); 
    }

    t(key) {
        const keys = key.split('.');
        let current = this.dictionary[this.locale];
        
        // Fallback to English dictionary if current language is missing keys
        // (Optional safety, assuming English is base)
        if (!current && this.locale !== 'en') {
            current = this.dictionary['en'];
        }
        if (!current) return key;

        for (const k of keys) {
            if (current[k] === undefined) {
                // console.warn(`Missing translation: ${key} (${this.locale})`);
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

    get lang() {
        return this.locale;
    }

    toggle() {
        const newLang = this.locale === 'en' ? 'tr' : 'en';
        this.setLocale(newLang);
    }
}

export const i18n = new LocalizationService();