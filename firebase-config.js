/* ============================================================
   إعدادات مشروع Firebase بتاعك
   هتلاقي القيم دي في: Firebase Console → ⚙️ Project settings
   → Your apps → التطبيق اللي هتعمله (Web) → SDK setup and configuration
   البيانات دي مش سر (Public) — الحماية الحقيقية موجودة في Firestore
   Security Rules مش في إخفاء القيم دي.
   ============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyAI83z_ILhE5Yq_xtfm4-48dTwKG7wkU9A",
  authDomain: "gm-marine.firebaseapp.com",
  projectId: "gm-marine",
  storageBucket: "gm-marine.firebasestorage.app",
  messagingSenderId: "409801841230",
  appId: "1:409801841230:web:6a446ea2727a506198411f"
};

firebase.initializeApp(firebaseConfig);
