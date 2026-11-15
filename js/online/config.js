// Firebase 網頁設定（跟舊版同一個專案 abogames）。這組設定本來就會公開在網頁裡，安全性靠 firestore.rules。
// S1 的資料都放在 s1_ 開頭的集合，不會動到舊版的 players、saves、gameConfig。
window.FIREBASE_CONFIG = {
            apiKey: 'AIzaSyAv3ADIShoqSbtlxQjlnrmFsXEudaYpv3g',
            authDomain: 'abogames.firebaseapp.com',
            projectId: 'abogames',
            storageBucket: 'abogames.firebasestorage.app',
            messagingSenderId: '204135940252',
            appId: '1:204135940252:web:c166596f854f137200ed59'
        };
