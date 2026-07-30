# MezoMenu - دليل إعداد Firebase والمصادقة

## 📋 المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [الملفات المُحدثة](#الملفات-المُحدثة)
3. [إعداد Firebase](#إعداد-firebase)
4. [تفعيل Google Sign-In](#تفعيل-google-sign-in)
5. [قواعد البيانات (Rules)](#قواعد-البيانات-rules)
6. [هيكل المشروع المُحدّث](#هيكل-المشروع-المُحدّث)

---

## نظرة عامة

تم تحديث مشروع **MezoMenu** ليدعم:
- ✅ تسجيل الدخول/إنشاء حساب بحساب **Google**
- ✅ المصادقة عبر **Firebase Auth**
- ✅ حفظ بيانات المستخدم في **Firebase Realtime Database**
- ✅ حماية الصفحات والتحقق من الجلسات
- ✅ كل صفحة تعمل بشكل مستقل ومُنفصل

---

## الملفات المُحدثة

### ملفات جديدة
| الملف | الوصف |
|------|-------|
| `assets/js/firebase-config.js` | إعدادات Firebase الأساسية |
| `assets/js/firebase-auth.js` | وحدة المصادقة الكاملة |
| `assets/js/auth-guard.js` | حماية الصفحات والتحقق من الجلسات |
| `firebase-rules.json` | قواعد أمان قاعدة البيانات |

### ملفات مُحدّثة
| الملف | التغييرات |
|------|----------|
| `admin/login.html` | دعم Google Sign-In + Firebase Auth |
| `admin/register.html` | دعم Google Sign-Up + Firebase Auth |
| `customer/profile.html` | تكامل كامل مع Firebase + تحديث البروفايل |

---

## إعداد Firebase

### 1. إنشاء مشروع Firebase
1. اذهب إلى [Firebase Console](https://console.firebase.google.com/)
2. أنشئ مشروع جديد أو اختر مشروع موجود
3. فعّل **Authentication**:
   - اذهب إلى Authentication → Sign-in method
   - فعّل **Email/Password**
   - فعّل **Google** (اتبع الخطوات أدناه)

### 2. إعداد Google Sign-In
1. في [Google Cloud Console](https://console.cloud.google.com/):
   - اختر المشروع أو أنشئ واحد جديد
2. اذهب إلى **APIs & Services → Credentials**
3. أنشئ **OAuth 2.0 Client ID**:
   - Application type: Web application
   - Authorized redirect URIs: أضف رابط موقعك
4. انسخ **Client ID**

### 3. الحصول على Firebase Config
1. في Firebase Console → Project Settings
2. نسخ `apiKey`, `authDomain`, `projectId`, etc.
3. حدّث الملفات التالية بالقيم الفعلية:

```javascript
// assets/js/firebase-config.js
const FIREBASE_CONFIG = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
```

### 4. تفعيل Realtime Database
1. في Firebase Console → Realtime Database
2. أنشئ قاعدة بيانات جديدة
3. ابدأ في وضع **Test mode** للتطوير
4. بعد ذلك، طبّق القواعد من `firebase-rules.json`

---

## قواعد البيانات (Rules)

ملف `firebase-rules.json` يحتوي على قواعد أمان شاملة:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth.uid == $uid || root.child('users').child(auth.uid).child('role').val() == 'admin'",
        ".write": "auth.uid == $uid"
      }
    },
    "restaurants": { ... },
    "orders": { ... },
    // ... المزيد من القواعد
  }
}
```

### كيفية تطبيق القواعد:
1. Firebase Console → Realtime Database → Rules
2. امسح القواعد الافتراضية
3. الصق محتوى `firebase-rules.json`
4. اضغط **Publish**

---

## هيكل المشروع المُحدّث

```
mezmenu-app/
├── admin/
│   ├── login.html          ← مُحدّث (Firebase + Google Auth)
│   ├── register.html       ← مُحدّث (Firebase + Google Auth)
│   ├── dashboard.html      ← يحتاج تحديث للحماية
│   ├── menu.html
│   ├── orders.html
│   ├── reservations.html
│   ├── promotions.html
│   ├── notifications.html
│   ├── analytics.html
│   ├── settings.html
│   └── ai-import.html
├── customer/
│   ├── index.html
│   ├── profile.html        ← مُحدّث (Firebase Integration)
│   ├── order-history.html
│   ├── favorites.html
│   └── order-tracking.html
├── assets/
│   ├── js/
│   │   ├── firebase-config.js     ← جديد
│   │   ├── firebase-auth.js       ← جديد
│   │   ├── auth-guard.js          ← جديد
│   │   ├── main.js
│   │   └── ...
│   └── css/
├── firebase-rules.json           ← جديد
└── package.json
```

---

## استخدام المصادقة في الصفحات الأخرى

### لإضافة حماية لصفحة:

```html
<!-- أضف هذا في head -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>

<!-- ثم استخدم -->
<script>
// تحقق من تسجيل الدخول
auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    } else {
        // المستخدم مسجل الدخول، حمّل الصفحة
        initPage(user);
    }
});
</script>
```

### للوصول لبيانات المستخدم:

```javascript
// الحصول على معلومات المستخدم الحالي
const user = auth.currentUser;
if (user) {
    console.log('User ID:', user.uid);
    console.log('Email:', user.email);
    console.log('Name:', user.displayName);
    
    // قراءة بياناته من Database
    db.ref(`users/${user.uid}`).once('value')
        .then((snapshot) => console.log(snapshot.val()));
}
```

---

## ملاحظات مهمة

### ⚠️ يجب تغيير:
1. **FIREBASE_CONFIG**: استبدل بقيم مشروعك الفعلية
2. **GOOGLE_CLIENT_ID**: احصل عليه من Google Cloud Console
3. **Database Rules**: طبّقها على قاعدة بياناتك

### 🔒 الأمان:
- لا تشارك مفاتيح API في الكود العام
- استخدم Environment Variables للإنتاج
- فعّل قواعد الأمان قبل الإطلاق

### 📱 PWA:
- التطبيق يدعم التشغيل offline
- يمكن تثبيته على الهاتف
- يعمل كتطبيق أصلي تقريباً

---

## الدعم

للمساعدة أو الاستفسارات:
- 📧 Email: support@mezo.menu
- 💬 Documentation: راجع التعليقات في الكود

---

**آخر تحديث:** 2026-07-30  
**الإصدار:** 3.0.0-Firebase
