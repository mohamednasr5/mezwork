# 🍽️ MezoMenu - نظام القوائم الذكية للمطاعم

<div align="center">

![MezoMenu Logo](https://img.shields.io/badge/MezoMenu-SaaS-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik04IDEzSDJ2OWgydi05bTE1LTVM5IDMgOSAzaDR2MmEzIDMgMCAwIDAtMy0zeiIvPjwvc3ZnPg==)
![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

**منصة SaaS متعددة المستأجرين لإدارة قوائم الطعام الذكية**

[🌐 Live Demo](#) • [📖 Documentation](#) • [🚀 Getting Started](#getting-started) • [💬 Support](#)

</div>

---

## ✨ المميزات الرئيسية

### 🏪 **لأصحاب المطاعم**
- **لوحة تحكم كاملة** - إدارة كاملة للمطعم من أي مكان
- **قائمة طعام ذكية** - تفاعلية، سريعة، وجميلة
- **إدارة الأقسام والأصناف** - تنظيم مرن للقائمة
- **إدارة الطلبات** - تتبع الطلبات في الوقت الحقيقي
- **تقارير متقدمة** - تحليلات المبيعات والإحصائيات

### 🤖 **الذكاء الاصطناعي (NVIDIA AI)**
- **تحليل القوائم بالصور** - ارفع صورة القائمة وسيقوم AI باستخراج كل شيء تلقائياً
- **توليد صور الطعام** - أنشئ صوراً احترافية للأطباق باستخدام Stable Diffusion XL
- **دعم اللغة العربية** - تحليل وتوليد محسّن للغة العربية

### 📱 **PWA مزدوج لكل مطعم**
- **PWA الإدارة** - لوحة تحكم تعمل بدون إنترنت
- **PWA الزبون** - قائمة جميلة للعملاء مع إمكانية التثبيت

### 🔒 **عزل تام بين المطاعم**
- كل مطعم معزول تماماً عن الآخرين
- بيانات آمنة ومشفرة
- صلاحيات وصول دقيقة

### 💬 **تكامل واتساب**
- استقبال الطلبات مباشرة على واتساب
- إشعارات فورية عند تغيير حالة الطلب
- رسائل تلقائية للعملاء

---

## 🛠️ التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|----------|
| **HTML/CSS/JavaScript** | Frontend (Vanilla JS - بدون أطر عمل) |
| **Cloudflare Workers** | Backend/API Serverless |
| **Cloudflare R2** | تخزين الصور |
| **Firebase Realtime Database** | قاعدة البيانات في الوقت الحقيقي |
| **NVIDIA AI API** | تحليل القوائم + توليد الصور |
| **PWA / Service Worker** | تطبيقات progressives |

---

## 📁 هيكل المشروع

```
mezomenu-saas/
├── public/                      # Frontend Files
│   ├── index.html               # Landing Page
│   ├── login.html               # تسجيل الدخول
│   ├── register.html            # التسجيل
│   ├── admin/                   # PWA لوحة التحكم
│   │   └── index.html           # Dashboard الرئيسي
│   ├── menu/                    # PWA قائمة الزبون
│   │   └── [slug]/index.html    # قائمة ديناميكية
│   ├── css/                     # Stylesheets
│   │   ├── style.css            # أنماط رئيسية
│   │   ├── auth.css             # أنماط المصادقة
│   │   └── admin.css            # أنماط لوحة التحكم
│   ├── js/                      # JavaScript
│   │   ├── app.js               # منطق التطبيق
│   │   ├── auth.js              # المصادقة
│   │   ├── admin.js             # لوحة التحكم
│   │   ├── firebase-config.js   # إعداد Firebase
│   │   └── nvidia-ai.js         # تكامل NVIDIA AI
│   ├── manifest-admin.json      # PWA Admin Manifest
│   ├── manifest-menu.json       # PWA Menu Manifest
│   └── sw.js                    # Service Worker
├── workers/                     # Cloudflare Workers
│   ├── api/                     # API Endpoints
│   │   ├── auth.worker.js       # المصادقة
│   │   ├── menu.worker.js       # إدارة القوائم
│   │   ├── orders.worker.js     # الطلبات
│   │   ├── upload.worker.js     # رفع الصور (R2)
│   │   └── ai.worker.js         # NVIDIA AI
│   └── shared/                  # Shared Utilities
│       ├── cors.js              # CORS Handling
│       ├── firebase.js          # Firebase Helper
│       └── r2.js                # R2 Storage Helper
├── .env.example                 # متغيرات البيئة
├── wrangler.toml                # Cloudflare Workers Config
├── package.json                 # Dependencies
└── README.md                    # هذا الملف
```

---

## 🚀 البدء السريع

### المتطلبات الأساسية

- Node.js 18+
- حساب Cloudflare (Workers + R2)
- حساب Firebase (Realtime Database)
- حساب NVIDIA (AI API) - اختياري للـ AI features

### 1. استنساخ المشروع

```bash
git clone https://github.com/yourusername/mezomenu-saas.git
cd mezomenu-saas
```

### 2. تثبيت التبعيات

```bash
npm install
```

### 3. إعداد البيئة

```bash
cp .env.example .env
# عدّل .env وأضف مفاتيحك الخاصة
```

### 4. إعداد Firebase

1. أنشئ مشروع جديد على [Firebase Console](https://console.firebase.google.com/)
2. فعّل **Realtime Database**
3. انسخ الإعدادات إلى `.env`
4. اضبط قواعد الأمان (انظر أدناه)

### 5. إعداد Cloudflare Workers

```bash
# تسجيل الدخول
npx wrangler login

# نشر المشروع
npx wrangler deploy
```

### 6. تشغيل محلياً

```bash
# تشغيل بيئة التطوير
npm run dev

# أو باستخدام Wrangler
npx wrangler dev
```

---

## ⚙️ الإعدادات

### قواعد أمان Firebase

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "restaurants": {
      "$restaurantId": {
        ".read": "data.child('ownerId').val() === auth.uid || root.child('public_menus').child(data.child('slug').val()).exists()",
        ".write": "data.child('ownerId').val() === auth.uid"
      }
    },
    "public_menus": {
      "$slug": {
        ".read": true,
        ".write": false
      }
    }
  }
}
```

### متغيرات البيئة المطلوبة

| المتغير | الوصف | مطلوب |
|---------|-------|--------|
| `FIREBASE_API_KEY` | مفتاح Firebase API | ✅ |
| `FIREBASE_PROJECT_ID` | معرف المشروع | ✅ |
| `FIREBASE_DATABASE_URL` | URL قاعدة البيانات | ✅ |
| `NVIDIA_API_KEY` | مفتاح NVIDIA AI | ❌ (للميزات AI) |
| `R2_BUCKET_NAME` | اسم bucket R2 | ✅ |
| `WHATSAPP_API_TOKEN` | توكن واتساب | ❌ (للتكامل) |

---

## 🎯 خطط الاشتراك

| الخطة | السعر | الأصناف | تحليل AI | توليد صور |
|-------|-------|---------|-----------|------------|
| **مجاني** | 0 ج.م/شهر | 20 | ❌ | ❌ |
| **احترافي** | 199 ج.م/شهر | ∞ | 100/شهر | 50/شهر |
| **مؤسسات** | 499 ج.م/شهر | ∞ | ∞ | ∞ |

---

## 📱 PWA Features

### PWA الإدارة (لصاحب المطعم)
- ✅ يعمل بدون إنترنت
- ✅ يمكن تثبيته على الشاشة الرئيسية
- ✅ إشعارات فورية للطلبات الجديدة
- ✅ إدارة كاملة للقائمة والطلبات

### PWA الزبون (للعملاء)
- ✅ تصفح القائمة بسهولة
- ✅ بحث وتصفية سريعة
- ✅ طلب مباشر عبر واتساب
- ✅ تصميم متجاوب لجميع الأجهزة

---

## 🤖 الذكاء الاصطناعي

### تحليل القوائم بالصور

1. ارفع صورة قائمة مطبوعة أو ورقية
2. سيقوم AI (Florence-2 من Microsoft/NVIDIA) بتحليلها
3. يستخرج تلقائياً:
   - اسم المطعم
   - الأقسام والمجموعات
   - الأصناف والأسعار
   - الوصفات

### توليد صور الطعام

1. اكتب وصفاً للطبق
2. سيقوم Stable Diffusion XL بتوليد صورة احترافية
3. خيارات مخصصة:
   - نمط التصوير
   - الأبعاد
   - جودة الصورة

---

## 🔒 العزل بين المطاعم

كل مطعم معزول تماماً:

```
restaurants/
├── restaurant_123/           # مطعم A
│   ├── menu/
│   ├── orders/
│   └── settings/
├── restaurant_456/           # مطعم B
│   ├── menu/
│   ├── orders/
│   └── settings/
```

**ضمانات العزل:**
- ✅ لا يمكن لأي مطعم رؤية بيانات الآخر
- ✅ كل API calls مُتحقق منها
- ✅ مسارات قاعدة البيانات معزولة
- ✅ ملفات R2 في مجلدات منفصلة

---

## 📊 REST API Endpoints

### المصادقة
```
POST   /api/auth/register      # إنشاء حساب جديد
POST   /api/auth/login         # تسجيل الدخول
POST   /api/auth/logout        # تسجيل الخروج
GET    /api/auth/verify        # التحقق من التوكن
```

### القوائم
```
GET    /api/menu/items         # جلب الأصناف
POST   /api/menu/items         # إضافة صنف
PUT    /api/menu/items/:id     # تحديث صنف
DELETE /api/menu/items/:id     # حذف صنف
GET    /api/menu/categories    # جلب الأقسام
POST   /api/menu/categories    # إضافة قسم
```

### الطلبات
```
GET    /api/orders             # جلب الطلبات
POST   /api/orders             # إنشاء طلب جديد
PUT    /api/orders/:id/status  # تحديث حالة الطلب
```

### الذكاء الاصطناعي
```
POST   /api/ai/analyze         # تحليل صورة قائمة
POST   /api/ai/generate        # توليد صورة طعام
GET    /api/ai/usage           # إحصائيات الاستخدام
```

### رفع الملفات
```
POST   /api/upload             # رفع صورة
DELETE /api/upload/:key         # حذف صورة
```

---

## 🧪 الاختبار

```bash
# تشغيل الاختبارات
npm test

# اختبار API endpoints
npm run test:api

# اختبار العزل بين المطاعم
npm run test:isolation
```

---

## 🚀 النشر

### إلى Cloudflare Workers

```bash
# بناء للإنتاج
npm run build

# نشر
npx wrangler deploy

# نشر لبيئة staging
npx wrangler deploy --env staging
```

### إلى GitHub Pages (Frontend فقط)

```bash
# بناء
npm run build:frontend

# نشر إلى gh-pages
npm run deploy:github
```

---

## 🤝 المساهمة

نرحب بمساهماتكم! يرجى:

1. Fork المشروع
2. إنشاء فرع (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. فتح Pull Request

---

## 📄 الرخصة

هذا المشروع مرخص تحت رخصة MIT - راجع ملف [LICENSE](LICENSE) للتفاصيل.

---

## 👨‍💻 المؤلف

**MezoMenu** - صنع ب ❤️ لمجتمع المطاعم العربي

<div align="center">
Made with ☕ and 💻 in Egypt 🇪🇬
</div>

---

## 🆘 الدعم

- 📧 Email: support@mezomenu.com
- 💬 Discord: [Join our server](#)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/mezomenu-saas/issues)
- 📖 Docs: [Documentation](#)

---

<div align="center">

**⭐ إذا أعجبك المشروع، لا تنسى إعطائه نجمة! ⭐**

[🔝 Top](#--mezomenu----sistema-de-menús-inteligente-para-restaurantes)

</div>
