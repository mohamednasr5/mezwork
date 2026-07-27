# 🍽️ MezoMenu SaaS - نظام القوائم الرقمية للمطاعم

<div align="center">

![MezoMenu Logo](assets/images/logo.png)

**منصة SaaS متكاملة لإدارة قوائم المطاعم الرقمية**

[🌐 موقع المعاينة](#) | [📖 التوثيق](docs/) | [🐛 الإبلاغ عن مشكلة](issues) | [💬 الدعم](#)

[![License: MIT](https://img.shields.io/badge/LICENSE-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/VERSION-4.1.0-blue.svg)](package.json)
[![Cloudflare Workers](https://img.shields.io/badge/BACKEND-CLOUDFLARE_WORKERS-orange.svg)](worker/)
[![Firebase](https://img.shields.io/badge/DATABASE-FIREBASE-yellow.svg)](firebase.json)
[![API Connected](https://img.shields.io/badge/API-CONNECTED-success.svg)](worker/index.js)

</div>

---

## ✨ نظرة عامة

MezoMenu هو نظام SaaS متكامل لإدارة قوائم المطاعم الرقمية، يتيح لأصحاب المطاعم إنشاء قوائم طعام رقمية احترافية وإدارتها بسهولة، مع إمكانية استيراد القائمة بالذكاء الاصطناعي واستقبال الطلبات عبر واتساب.

### 🎯 الميزات الرئيسية

#### 📱 تطبيقين PWA منفصلين:
- **لوحة تحكم المدير (Admin PWA)**: لإدارة كامل المطعم
- **تطبيق العميل (Customer PWA)**: لعرض القائمة وطلب الطعام

#### 🔧 ميزات لوحة التحكم:
- ✅ تسجيل الدخول والتسجيل
- ✅ إدارة بيانات المطعم (الشعار، الموقع، مواعيد العمل)
- ✅ إدارة القائمة الكاملة (تصنيفات، أصناف، أسعار، أحجام، إضافات)
- ✅ **استيراد ذكي بالذكاء الاصطناعي** (من صور أو PDF)
- ✅ إدارة الطلبات مع تتبع الحالة
- ✅ نظام إشعارات متقدم
- ✅ رمز QR للقائمة
- ✅ إحصائيات وتحليلات
- ✅ إعدادات واتساب مخصصة
- ✅ نظام اشتراكات (لصاحب المنصة)
- ✅ تخصيص المظهر والألوان

#### 👥 ميزات العميل:
- ✅ عرض احترافي للقائمة
- ✅ بحث وتصفية حسب التصنيف
- ✅ سلة مشتريات
- ✅ طلب عبر واتساب مع جميع التفاصيل
- ✅ تتبع حالة الطلب
- ✅ إشعارات فورية
- ✅ دعم كامل للعربية (RTL)

---

## 🛠️ التقنيات المستخدمة

| التقنية | الاستخدام |
|---------|-----------|
| **HTML5** | هيكل الصفحات |
| **CSS3** | التصميم المتجاوب والرسوم المتحركة |
| **JavaScript (Vanilla)** | المنطق والتفاعلية |
| **Cloudflare Worker** | Backend API |
| **R2 Storage** | تخزين الملفات والصور |
| **Firebase Realtime Database** | قاعدة البيانات |
| **Agnes AI / Nvidia AI** | الذكاء الاصطناعي لاستخراج القوائم |
| **WhatsApp API** | إرسال الطلبات والإشعارات |

---

## 📁 هيكل المشروع

```
menomenu-saas/
├── index.html                 # الصفحة الرئيسية (Landing Page)
├── README.md                  # هذا الملف
├── LICENSE                    # رخصة MIT
├── .gitignore                 # ملف Gitignore
│
├── admin/                     # لوحة تحكم المدير (Admin PWA)
│   ├── login.html             # صفحة تسجيل الدخول
│   ├── register.html          # صفحة التسجيل
│   ├── dashboard.html         # لوحة الإحصائيات
│   ├── menu.html              # إدارة القائمة
│   ├── ai-import.html         # الاستيراد بالذكاء الاصطناعي
│   ├── orders.html            # إدارة الطلبات
│   ├── settings.html          # إعدادات المطعم
│   ├── notifications.html     # الإشعارات
│   ├── manifest.json          # PWA Manifest للـ Admin
│   └── sw.js                  # Service Worker للـ Admin
│
├── customer/                  # تطبيق العميل (Customer PWA)
│   ├── index.html             # صفحة عرض القائمة
│   ├── manifest.json          # PWA Manifest للـ Customer
│   └── sw.js                  # Service Worker للـ Customer
│
├── assets/                    # الملفات الثابتة
│   ├── css/
│   │   ├── main.css           # الأنماط الرئيسية
│   │   ├── admin.css          # أنماط لوحة التحكم
│   │   └── customer.css       # أنماط صفحة العميل
│   ├── js/
│   │   ├── main.js            # JavaScript الرئيسي
│   │   ├── orders.js          # وظائف إدارة الطلبات
│   │   ├── settings.js        # وظائف الإعدادات
│   │   ├── ai-import.js       # وظائف الاستيراد الذكي
│   │   └── notifications.js   # وظائف الإشعارات
│   └── images/
│       ├── logo.png           # شعار التطبيق
│       ├── favicon.png        # أيقونة الموقع
│       └── icon-*.png         # أيقونات PWA
│
├── worker/                    # Cloudflare Worker Backend
│   └── index.js               # كود الـ Worker
│
└── docs/                      # التوثيق
    └── (قريباً)
```

---

## 🚀 البدء السريع

### 1. المتطلبات الأساسية
- حساب على [Cloudflare](https://cloudflare.com)
- مشروع على [Firebase Console](https://console.firebase.google.com)
- مفتاح API من [Agnes AI](https://platform.agnes-ai.com) (اختياري للميزات الذكية)

### 2. إعداد Cloudflare Worker

```bash
# 1. تثبيت Wrangler CLI
npm install -g wrangler

# 2. تسجيل الدخول
wrangler login

# 3. نشر الـ Worker
cd worker
wrangler deploy

# 4. إضافة المتغيرات البيئية
wrangler secret put AGNES_AI_API_KEY
wrangler secret put FIREBASE_API_KEY
wrangler secret put R2_BUCKET_NAME
```

### 3. إعداد Firebase

1. أنشئ مشروع جديد على Firebase Console
2. فعّل Realtime Database
3. أضف قواعد الأمان (انظر `firebase-rules.json`)
4. انسخ إعدادات المشروع إلى `worker/index.js`

### 4. تشغيل المشروع محلياً

```bash
# باستخدام أي خادم محلي
cd menomenu-saas
python -m http.server 8080

# أو باستخدام Live Server في VS Code
```

### 5. الوصول للتطبيق

- **الصفحة الرئيسية**: http://localhost:8080
- **لوحة التحكم**: http://localhost:8080/admin/dashboard.html
- **قائمة العميل**: http://localhost:8080/customer/index.html?slug=el-mabrouk

---

## 🔌 API Endpoints (v4.1)

> **Base URL**: `https://menu.nonm1724.workers.dev`

### المصادقة (Auth)
| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/api/auth/login` | POST | تسجيل الدخول |
| `/api/auth/register` | POST | إنشاء حساب جديد |
| `/api/auth/user` | GET | جلب بيانات المستخدم |

### القائمة (Menu)
| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/api/menu?restaurantId={id}` | GET | جلب القائمة |
| `/api/menu` | POST | حفظ/إنشاء قائمة |
| `/api/menu?restaurantId={id}` | PUT | تحديث قائمة |

### الطلبات (Orders)
| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/api/orders?restaurantId={id}` | GET | جلب الطلبات |
| `/api/orders` | POST | إنشاء طلب جديد |
| `/api/orders/{orderId}?restaurantId={id}` | PUT | تحديث حالة الطلب |

### الذكاء الاصطناعي (AI)
| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/api/ai/chat` | POST | محادثة مع AI |
| `/api/ai/image` | POST | توليد صور بالAI |
| `/api/ai/analyze` | POST | تحليل صورة القائمة (OCR) |
| `/api/ai/status` | GET | حالة خدمات AI |

### الإشعارات (Notifications)
| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/api/notifications?userId={id}` | GET | جلب الإشعارات |
| `/api/notifications?userId={id}` | DELETE | مسح جميع الإشعارات |

### الإحصائيات (Dashboard)
| Endpoint | Method | الوصف |
|----------|--------|-------|
| `/api/stats/dashboard?userId={id}` | GET | إحصائيات لوحة التحكم |

---

## ⚙️ الإعدادات والتهيئة

### متغيرات البيئة المطلوبة

| المتغير | الوصف | مثال |
|---------|-------|------|
| `AGNES_AI_API_KEY` | مفتاح Agnes AI API | `agnes-xxx...` |
| `FIREBASE_API_KEY` | مفتاح Firebase API | `AIzaSyxxx...` |
| `FIREBASE_PROJECT_ID` | معرف مشروع Firebase | `menu-b41e6` |
| `R2_BUCKET_NAME` | اسم R2 Bucket | `mezomenu-uploads` |

### إعدادات Firebase Rules

```json
{
  "rules": {
    ".read": true,
    ".write": "auth != null",
    "restaurants": {
      "$restaurantId": {
        ".read": true,
        ".write": "auth.uid == $restaurantId || root.child('admins').child(auth.uid).exists()"
      }
    },
    "orders": {
      "$orderId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

---

## 📊 نقاط النهاية API (Endpoints)

### المصادقة
| Method | Endpoint | الوصف |
|--------|----------|-------|
| POST | `/api/auth/register` | تسجيل حساب جديد |
| POST | `/api/auth/login` | تسجيل الدخول |
| GET | `/api/auth/me` | جلب بيانات المستخدم |

### القائمة
| Method | Endpoint | الوصف |
|--------|----------|-------|
| GET | `/api/menu/:slug` | جلب قائمة مطعم |
| POST | `/api/menu` | حفظ/تحديث القائمة |
| POST | `/api/menu/import` | استيراد قائمة بالذكاء الاصطناعي |

### الطلبات
| Method | Endpoint | الوصف |
|--------|----------|-------|
| GET | `/api/orders` | جلب طلبات المطعم |
| POST | `/api/orders` | إنشاء طلب جديد |
| PUT | `/api/orders/:id/status` | تحديث حالة الطلب |

### الملفات
| Method | Endpoint | الوصف |
|--------|----------|-------|
| POST | `/api/upload` | رفع ملف إلى R2 |

### الذكاء الاصطناعي
| Method | Endpoint | الوصف |
|--------|----------|-------|
| POST | `/api/ai/analyze` | تحليل صورة القائمة |
| GET | `/api/ai/status` | حالة خدمة AI |

---

## 💰 نظام الاشتراكات

### الباقات المتاحة

| الباقة | السعر | المميزات |
|--------|-------|---------|
| **مجاني** | 0 ج.م | 50 صنف، طلبات واتساب، بدون تحليلات |
| **احترافي** | 199 ج.م/شهر | أصناف غير محدودة، AI، تحليلات، دعم بريد |
| **مؤسسات** | 499 ج.م/شهر | فروع متعددة، API مخصص، دعم 24/7 |

---

## 🎨 تخصيص المظهر

يمكن تخصيص ألوان التطبيق من خلال:

1. **CSS Variables** في `assets/css/main.css`
2. **إعدادات المطعم** > تبويب "المظهر"
3. **ألوان مخصصة** عبر Color Picker

```css
:root {
    --primary-color: #ff6b35;    /* اللون الرئيسي */
    --secondary-color: #f7931e;  /* اللون الثانوي */
    --dark-color: #1a1a2e;       /* اللون الداكن */
}
```

---

## 🌍 دعم اللغات

التطبيق يدعم بشكل كامل:
- ✅ **العربية** (RTL) - اللغة الافتراضية
- ✅ **English** (LTR) - قيد التطوير

---

## 🤝 المساهمة في المشروع

نرحب بمساهماتكم! يرجى اتباع الخطوات التالية:

1. Fork المشروع
2. إنشاء فرع جديد (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push إلى الفرع (`git push origin feature/amazing-feature`)
3. فتح Pull Request

---

## 📝 الترخيص

هذا المشروع مرخص تحت ترخيص [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 MezoMenu Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 👥 فريق العمل

- **المطور الرئيسي**: MezoMenu Team
- **التصميم**: UI/UX Team

---

## 📞 الدعم والتواصل

هل لديك سؤال أو اقتراح؟ تواصل معنا:

- 📧 البريد الإلكتروني: support@mezo.menu
- 🌐 الموقع: https://mezo.menu
- 💬 واتساب: +20 127 993 4735

---

<div align="center">

**⭐ إذا أعجبك المشروع، لا تنسى إعطائه نجمة! ⭐**

Made with ❤️ by [MezoMenu Team](https://github.com/mezomenu)

</div>
