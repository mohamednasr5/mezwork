# 🔧 إعداد Firebase API Keys - دليل خطوة بخطوة

## ❌ المشكلة الحالية
```
auth/api-key-not-valid.-please-pass-a-valid-api-key
```
هذا الخطأ يعني أن مفتاح API في الملف غير صالح.

---

## ✅ الحل - كيف تحصل على المفاتيح الصحيحة

### الخطوة 1: الحصول على Firebase API Key

1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. اختر مشروعك: **project-912801475897** (أو اسم مشروعك)
3. من القائمة الجانبية اضغط: **⚙️ Settings (إعدادات)**
4. ثم **General (عام)**
5. اسفل الصفحة ستجد قسم **Your apps** أو **Apps**
6. اضغط على أيقونة **</> (Web)**
7. ستجد الـ **firebaseConfig** كامل - انسخه!

**ستجد شيئاً مثل هذا:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB_真正的密钥在这里",  // ← هذا ما تحتاجه
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  // ... باقي الإعدادات
};
```

---

### الخطوة 2: تفعيل Google Sign-In والحصول على Client ID

من نفس صفحة Firebase Console:

1. اذهب إلى **Authentication (المصادقة)** من القائمة الجانبية
2. اضغط على **Sign-in method (طرق تسجيل الدخول)**
3. اضغط على **Google** (يجب أن يكون مفعل ✓)
4. اضغط عليه لفتح الإعدادات
5. ستجد قسم **Web SDK configuration**
6. هنا ستجد:
   - **Web client ID** - انسخه!
   - **Web client secret** - لا تحتاجه في الواجهة الأمامية

**ملاحظة:** إذا كانت الحقول فارغة كما في صورتك:
- اضغط **Save & Enable** أولاً
- سيتم إنشاء Web Client ID تلقائياً

---

### الخطوة 3: تحديث ملف `firebase-config.js`

افتح الملف: `assets/js/firebase-config.js`

واستبدل القيم بهذه الطريقة:

```javascript
// ===================================
// استبدل هذه القيم بالقيم الحقيقية من Firebase Console
// ===================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB_这里粘贴你的真实API_KEY",      // ← من الخطوة 1
    authDomain: "你的项目名.firebaseapp.com",          // ← عادةً يتولد تلقائياً
    databaseURL: "https://你的项目名-default-rtdb.firebaseio.com",
    projectId: "你的项目ID",                            // ← من Firebase Settings
    storageBucket: "你的项目名.appspot.com",
    messagingSenderId: "数字",                          // ← من Firebase Settings > Cloud Messaging
    appId: "1:数字:web:字符串"                           // ← من الخطوة 1
};

// Google OAuth Client ID - من الخطوة 2
const GOOGLE_CLIENT_ID = 'XXXXXXXXXXXX.apps.googleusercontent.com';  // ← من Web SDK configuration
```

---

## 📍 أين تجد كل قيمة؟

| المتغير | الموقع في Firebase Console |
|---------|---------------------------|
| `apiKey` | Project Settings → General → Apps → SDK setup |
| `authId` | يتولد تلقائياً من projectId |
| `projectId` | Project Settings → General |
| `messagingSenderId` | Project Settings → Cloud Messaging |
| `appId` | Project Settings → General → Apps → SDK setup |
| `GOOGLE_CLIENT_ID` | Authentication → Sign-in method → Google → Web SDK config |

---

## ⚠️ ملاحظات مهمة

1. **لا تشارك مفتاح API أبداً** - هذا للمتصفح فقط وهو آمن للمشاريع الأمامية
2. **تأكد من تفعيل Google Sign-In** قبل نسخ الـ Client ID
3. **أعد تشغيل المتصفح** بعد تحديث المفاتيح
4. **افتح Console (F12)** للتأكد من عدم وجود أخطاء

---

## 🧪 اختبار العمل

بعد التحديث، افتح صفحة `register.html` أو `login.html` واضغط على زر Google:

✅ إذا عمل: سيظهر نافذة اختيار حساب Google  
❌ إذا فشل: تأكد من:
- أن مفتاح API صحيح (بدون فراغات إضافية)
- أن Google Sign-In مفعّل في Firebase
- أن Client ID صحيح

---

## 🆘 مشاكل شائعة

| المشكلة | الحل |
|---------|------|
| `api-key-not-valid` | انسخ المفتاح مرة أخرى بدون أي تغيير |
| `popup-closed-by-user` | اسمح للـ popups في المتصفح |
| `unauthorized-domain` | أضف نطاقك في Authentication → Domains |

---

**بعد إضافة المفاتيح الصحيحة، أعد ضغط الملف وأعد رفعه!** 🚀
