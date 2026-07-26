# MezoMenu SaaS - نظام قوائم المطاعم الذكية

## 🍽️ نظرة عامة

**MezoMenu** هو نظام SaaS متكامل لإدارة قوائم المطاعم بالذكاء الاصطناعي. يتيح لأصحاب المطاعم إنشاء وإدارة قوائمهم الرقمية مع ميزات متقدمة مثل:

- 🤖 تحليل القوائم تلقائياً باستخدام NVIDIA AI
- 🎨 توليد صور احترافية للأصناف بالذكاء الاصطناعي
- 📱 تطبيق PWA مزدوج (إدارة + زبون) لكل مطعم
- 🔒 عزل تام بين المطاعم (Multi-tenancy)
- 💬 تكامل واتساب لاستقبال الطلبات
- 🔔 إشعارات فورية لحالة الطلبات
- 📊 تحليلات وتقارير متقدمة

---

## 🛠️ التقنيات المستخدمة

### Frontend
- **HTML5 / CSS3 / JavaScript** (Vanilla)
- **PWA** (Progressive Web App)
- **RTL Design** للغة العربية
- **Cairo Font** للخط العربي الاحترافي

### Backend & Infrastructure
- **Cloudflare Workers** - API Serverless
- **Cloudflare R2** - تخزين الصور
- **Firebase Realtime Database** - قاعدة بيانات الوقت الحقيقي
- **NVIDIA AI API** - الذكاء الاصطناعي (تحليل + توليد صور)

---

## 📁 هيكل المشروع

```
mezomenu-saas/
├── public/                      # الملفات العامة (Frontend)
│   ├── index.html              # الصفحة الرئيسية (Landing Page)
│   ├── login.html              # تسجيل الدخول
│   ├── register.html           # التسجيل
│   ├── admin/                  # PWA لوحة تحكم الإدارة
│   │   └── index.html          # Dashboard الرئيسي
│   ├── menu/[slug]/            # PWA قائمة الزبون
│   │   └── index.html          # صفحة القائمة
│   ├── css/                    # ملفات التنسيق
│   │   ├── main.css            # الأنماط الأساسية
│   │   ├── auth.css            # أنماط المصادقة
│   │   ├── admin.css           # أنماط لوحة التحكم
│   │   ├── menu.css            # أنماط قائمة الزبون
│   │   └── landing.css         # أنماط الصفحة الرئيسية
│   ├── js/                     # ملفات JavaScript
│   │   ├── main.js             # الوظائف الأساسية
│   │   ├── auth.js             # منطق المصادقة
│   │   ├── admin.js            # منطق لوحة التحكم
│   │   └── menu.js             # منطق قائمة الزبون
│   ├── manifest-admin.json     # PWA Manifest للإدارة
│   ├── manifest-menu.json      # PWA Manifest للزبون
│   └── sw.js                   # Service Worker
│
├── workers/                     # Cloudflare Workers (Backend)
│   ├── api-worker.js           # API الرئيسي
│   ├── auth.js                 # نظام المصادقة (JWT)
│   ├── firebase-client.js      # تكامل Firebase RTDB
│   ├── nvidia-ai.js            # تكامل NVIDIA AI
│   └── r2-storage.js           # تكامل Cloudflare R2
│
├── config/
│   └── wrangler.toml           # إعدادات Cloudflare Workers
│
└── README.md                    # هذا الملف
```

---

## 🚀 التثبيت والتشغيل

### المتطلبات المسبقة

1. حساب على [Cloudflare](https://cloudflare.com)
2. حساب على [Firebase](https://firebase.google.com)
3. مفتاح API من [NVIDIA AI](https://build.nvidia.com/)
4. Node.js (للتشغيل المحلي الاختباري)
5. Wrangler CLI (`npm install -g wrangler`)

### 1. إعداد Cloudflare Workers

```bash
# تثبيت Wrangler
npm install -g wrangler

# تسجيل الدخول
wrangler login

# إنشاء R2 Bucket
wrangler r2 bucket create mezomenu-images

# نشر المشروع
cd workers
wrangler deploy
```

### 2. إعداد المتغيرات البيئية

```bash
# إضافة الأسرار
wrangler secret put NVIDIA_API_KEY
wrangler secret put JWT_SECRET
wrangler secret put PASSWORD_SALT
wrangler secret put FIREBASE_API_KEY
```

### 3. إعداد Firebase Realtime Database

1. أنشئ مشروع جديد على Firebase Console
2. فعّل Realtime Database
3. حدّث قواعد الأمان:

```json
{
  "rules": {
    "restaurants": {
      "$restaurantId": {
        ".read": "auth != null && auth.token.restaurantId == $restaurantId",
        ".write": "auth != null && auth.token.restaurantId == $restaurantId"
      }
    },
    "menus": {
      "$restaurantId": {
        ".read": true,
        ".write": "auth != null && auth.token.restaurantId == $restaurantId"
      }
    },
    "orders": {
      "$orderId": {
        ".read": "auth != null",
        ".write": true
      }
    }
  }
}
```

### 4. تشغيل المشروع محلياً

```bash
# باستخدام خادم محلي بسيط
cd public
python3 -m http.server 8080

# أو باستخدام wrangler dev
wrangler dev
```

---

## 🔐 نظام العزل بين المطاعم (Multi-tenancy)

يضمن MezoMenu عزلاً تاماً بين المطاعم:

### 1. مستوى قاعدة البيانات
- كل مطعم له `restaurantId` خاص
- البيانات تُفحص دائماً قبل الوصول
- قواعد Firebase تمنع الوصول غير المصرح به

### 2. مستوى API
- JWT Token يحتوي على `restaurantId`
- كل طلب يتحقق من ملكية المطعم
- لا يمكن لمستخدم رؤية بيانات مطعم آخر

### 3. مستوى الواجهة الأمامية
- كل PWA يحمل بيانات مطعمة فقط
- لا وجود لـ API عام يعرض جميع المطاعم

---

## 🤖 تكامل NVIDIA AI

### تحليل القوائم (Menu Analysis)

يرفع صاحب المطعم صورة القائمة، ويقوم AI بـ:
- استخراج الأقسام تلقائياً
- قراءة الأسماء والأسعار
- تنظيم البيانات في هيكل منظم

```javascript
// مثال الاستخدام
const result = await analyzeMenuImage(imageData, nvidiaApiKey);
// النتيجة: { categories: [...], items: [...], confidence: 0.95 }
```

### توليد الصور (Image Generation)

يُنشئ صوراً احترافية لكل صنف:

```javascript
// مثال الاستخدام
const imageResult = await generateFoodImage(
    'بيتزا مارجريتا',
    { itemName: 'بيتزا مارجريتا', style: 'professional' },
    nvidiaApiKey
);
// النتيجة: { image: base64, url: '...' }
```

---

## 📱 PWA - Progressive Web App

### PWA الإدارة (Admin)
- **المسار:** `/admin/`
- **الميزات:**
  - Dashboard بإحصائيات
  - إدارة القائمة والأصناف
  - عرض الطلبات والعملاء
  - الإعدادات والمبيعات
  - يعمل بدون إنترنت بعد التثبيت

### PWA الزبون (Customer Menu)
- **المسار:** `/menu/[slug]/`
- **الميزات:**
  - عرض القائمة بشكل جميل
  - سلة مشتريات تفاعلية
  - طلب عبر واتساب
  - قائمة مفضلة
  - يعمل بدون إنترنت

---

## 💬 تكامل واتساب

عندما يطلب الزبون، يتم:

1. تجميع بيانات الطلب في رسالة منسقة
2. فتح واتساب برقم المطعم
3. إرسال الطلب مباشرة

**تنسيق الرسالة:**
```
🆕 *طلب جديد من MezoMenu*

📍 المطعم: مطعم البركة
👤 الزبون: أحمد محمد
📱 الهاتف: 01012345678

*📋 تفاصيل الطلب:*
─────────────────
1. بيتزا مارجريتا ×2 - 240 ج.م
2. برجر لحم - 180 ج.م
─────────────────

💰 *الإجمالي: 420 ج.م*
```

---

## 🔔 نظام الإشعارات

### Push Notifications
- عند استلام طلب جديد
- تغيير حالة الطلب
- تقييم جديد من زبون

### WhatsApp Notifications
- تأكيد الطلب للزبون
- إشعار جاهزية الطلب

---

## 📊 صفحات لوحة التحكم

| # | الصفحة | المسار | الوصف |
|---|--------|--------|-------|
| 1 | الرئيسية | `/admin/` | Dashboard مع إحصائيات |
| 2 | تحرير القائمة | `/admin/menu.html` | تعديل الأقسام والأصناف |
| 3 | تراكب ذكي | `/admin/ai-analyze.html` | تحليل القائمة بالـ AI |
| 4 | الأقسام | `/admin/categories.html` | إدارة أقسام القائمة |
| 5 | الأصناف | `/admin/items.html` | إدارة أصناف الطعام |
| 6 | الطلبات | `/admin/orders.html` | عرض وإدارة الطلبات |
| 7 | العملاء | `/admin/customers.html` | قائمة العملاء |
| 8 | التسويق | `/admin/marketing.html` | أدوات تسويقية |
| 9 | المبيعات | `/admin/analytics.html` | تقارير المبيعات |
| 10 | الفروع | `/admin/branches.html` | إدارة الفروع |
| 11 | الإعدادات | `/admin/settings.html` | إعدادات المطعم |
| 12 | المساعدة | `/admin/help.html` | الدعم والمساعدة |

---

## ⚙️ الإعدادات

### متغيرات البيئة المطلوبة

| المتغير | الوصف | مثال |
|---------|-------|------|
| `NVIDIA_API_KEY` | مفتاح API لـ NVIDIA | `nvapi-xxxxx...` |
| `JWT_SECRET` | سر توقيع JWT | `your-secret-key` |
| `PASSWORD_SALT` | ملح تشفير كلمات المرور | `random-salt-string` |
| `FIREBASE_API_KEY` | مفتاح Firebase | `AIzaSy...` |
| `FIREBASE_DATABASE_URL` | URL قاعدة البيانات | `https://xxx.firebaseio.com` |

---

## 🎨 التصميم

### نظام الألوان
- **الأساسي:** `#DC2626` (أحمر)
- **النجاح:** `#22C55E` (أخضر)
- **التحذير:** `#F59E0B` (برتقالي)
- **المعلومات:** `#3B82F6` (أزرق)

### الخطوط
- **العربية:** Cairo (Google Fonts)
- **الإنجليزية:** Inter (اختياري)

### الاتجاه
- RTL (Right-to-Left) للعربية
- دعم تبديل اللغة

---

## 🚀 النشر على GitHub

```bash
# تهيئة Git
git init
git add .
git commit -m "Initial commit: MezoMenu SaaS"

# إضافة Remote
git remote add origin https://github.com/YOUR_USERNAME/mezomenu-saas.git

# الدفع
git push -u origin main
```

---

## 📄 الترخيص

هذا المشروع للعرض التعليمي. للحصول على ترخيص تجاري، تواصل معنا.

---

## 👨‍💻 المساهمة

نرحب بمساهماتكم! يرجى:
1. Fork المشروع
2. إنشاء فرع (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. فتح Pull Request

---

## 📞 الدعم

- **واتساب:** +20 155 805 6568
- **البريد:** support@mezomenu.com
- **الموقع:** https://mezomenu.com

---

**صنع بـ ❤️ بواسطة فريق MezoMenu**
