/* public/js/services/LocalizationService.js */
export const DICTIONARY = {
    en: {
        nav: { home: "Home", wishlist: "Wishlist", inspo: "Inspo", closet: "Closet", combos: "Combos", friends: "Friends", profile: "Profile", settings: "Settings" },
        home: { title: "My Wishlist", subtitle: "Dreams & Goals", addBtn: "Add Wish", empty: "Your wishlist is empty.", share_btn: "Share List", planner_locked: "Add 3 items to unlock AI Planner", sale_filter: "% Sale" },
        inspo: { title: "Inspo Boards", subtitle: "Visualize your vibe", create: "Create Board", add_pin: "Add Pin", visual_board: "Visual Board", ai_ideas: "✨ AI Ideas", settings: "Board Settings", empty_desc: "This board is empty. Start pinning!" },
        closet: { title: "My Closet", subtitle: "Your collection", add_manual: "Add Item", empty: "Closet is empty." },
        friends: { title: "Friends", subtitle: "Connect & Share", empty: "No friends yet.", search_placeholder: "Find by username..." },
        profile: { title: "Profile", basic_info: "Basic Info", privacy_settings: "Privacy", save_changes: "Save Changes", logout: "Log Out", delete_account: "Delete Account", danger_zone: "Danger Zone", fullname: "Display Name", username: "Username", birthday: "Birthday", privacy_label: "Profile Visibility", privacy_desc: "Who can see your wishlist?", public: "Public", friends_only: "Friends Only", only_me: "Only Me" },
        settings: {
            title: "Settings",
            account: "Account",
            appearance: "Appearance",
            language: "Language",
            notifications: "Notifications",
            data: "Data & Privacy",
            theme_light: "Light",
            theme_dark: "Dark",
            theme_system: "System",
            export_data: "Export Data",
            delete_acc_confirm: "Are you sure? This is permanent."
        },
        modal: { title: "Add Item", editTitle: "Edit Item", what: "What is it?", price: "Price", occasion: "Occasion", occasion_custom: "Custom Occasion", privacy: "Privacy", category: "Category", customCategory: "Custom Category", priority: "Priority", image: "Image", cancel: "Cancel", save: "Save", fetch: "Magic Get" },
        time: { overdue: "Overdue", today: "Today!", days_left: "days left", next_month: "Next Month", years: "years", months: "months" },
        common: { loading: "Loading...", error: "Something went wrong", success: "Success!", confirm: "Are you sure?", saving: "Saving...", delete: "Delete" },
        ai: { inputPlaceholder: "Paste link or type...", suggestion: "AI Suggestion", error: "AI Error" }
    },
    tr: {
        nav: { home: "Anasayfa", wishlist: "İstekler", inspo: "Pano", closet: "Gardırop", combos: "Kombinler", friends: "Arkadaşlar", profile: "Profil", settings: "Ayarlar" },
        home: { title: "İstek Listem", subtitle: "Hayaller & Hedefler", addBtn: "Ekle", empty: "Listeniz boş.", share_btn: "Paylaş", planner_locked: "Planlayıcı için 3 ürün ekle", sale_filter: "İndirim" },
        inspo: { title: "İlham Panosu", subtitle: "Tarzını yansıt", create: "Pano Oluştur", add_pin: "Pin Ekle", visual_board: "Görsel Pano", ai_ideas: "✨ AI Fikirleri", settings: "Pano Ayarları", empty_desc: "Bu pano boş." },
        closet: { title: "Gardırobum", subtitle: "Koleksiyonun", add_manual: "Ürün Ekle", empty: "Gardırop boş." },
        friends: { title: "Arkadaşlar", subtitle: "Bağlan & Paylaş", empty: "Henüz arkadaşın yok.", search_placeholder: "Kullanıcı adı ara..." },
        profile: { title: "Profil", basic_info: "Temel Bilgiler", privacy_settings: "Gizlilik", save_changes: "Kaydet", logout: "Çıkış Yap", delete_account: "Hesabı Sil", danger_zone: "Tehlikeli Bölge", fullname: "Ad Soyad", username: "Kullanıcı Adı", birthday: "Doğum Günü", privacy_label: "Profil Görünürlüğü", privacy_desc: "Listeni kimler görebilir?", public: "Herkese Açık", friends_only: "Sadece Arkadaşlar", only_me: "Sadece Ben" },
        settings: {
            title: "Ayarlar",
            account: "Hesap",
            appearance: "Görünüm",
            language: "Dil",
            notifications: "Bildirimler",
            data: "Veri & Gizlilik",
            theme_light: "Aydınlık",
            theme_dark: "Karanlık",
            theme_system: "Sistem",
            export_data: "Verilerimi İndir",
            delete_acc_confirm: "Emin misin? Bu işlem geri alınamaz."
        },
        modal: { title: "Ürün Ekle", editTitle: "Düzenle", what: "Ne ekliyorsun?", price: "Fiyat", occasion: "Sebep/Etkinlik", occasion_custom: "Özel...", privacy: "Gizlilik", category: "Kategori", customCategory: "Kategori Adı", priority: "Öncelik", image: "Görsel", cancel: "İptal", save: "Kaydet", fetch: "Otomatik Çek" },
        time: { overdue: "Gecikti", today: "Bugün!", days_left: "gün kaldı", next_month: "Gelecek Ay", years: "yıl", months: "ay" },
        common: { loading: "Yükleniyor...", error: "Bir hata oluştu", success: "Başarılı!", confirm: "Emin misiniz?", saving: "Kaydediliyor...", delete: "Sil" },
        ai: { inputPlaceholder: "Link yapıştır veya yaz...", suggestion: "AI Önerisi", error: "AI Hatası" }
    }
};

class LocalizationService {
    constructor() {
        this.locale = localStorage.getItem('wishone_locale') || 'en';
        this.listeners = [];
    }

    setLocale(lang) {
        if (!DICTIONARY[lang]) return;
        this.locale = lang;
        localStorage.setItem('wishone_locale', lang);
        this.notifyListeners();
        // Force simple reload for MVP simplicity if needed, but preferably notify
        // window.location.reload(); 
    }

    t(key) {
        const keys = key.split('.');
        let current = DICTIONARY[this.locale];
        for (const k of keys) {
            if (current[k] === undefined) return key;
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