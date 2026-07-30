# MezoMenu - نظام إدارة المطعم

نظام متكامل لإدارة المطعم يعمل بتقنية HTML + CSS + JavaScript مع Firebase و Cloudflare Worker.

## 📁 هيكل المشروع

```
mezomenu-html/
├── index.html              # الصفحة الرئيسية (لوحة إدارة المطعم)
├── css/
│   └── styles.css          # ملف التنسيقات الكامل
├── js/
│   ├── firebase.js         # تكوين Firebase و API REST
│   └── app.js              # منطق التطبيق الرئيسي
├── customer/
│   └── index.html          # صفحة العميل (عرض القائمة)
├── worker/
│   └── index.js            # Cloudflare Worker (API Server)
└── wrangler.toml           # إعدادات Cloudflare
```

## ✨ المميزات

### لوحة الإدارة
- **لوحة التحكم**: إحصائيات شاملة (الطلبات، الإيرادات، العناصر، الحجوزات)
- **إدارة القائمة**: CRUD كامل للعناصر والفئات مع رفع الصور
- **إدارة الطلبات**: تتبع الطلبات وتحديث الحالات
- **العروض**: إنشاء وإدارة العروض والتخفيضات
- **الحجوزات**: إدارة حجوزات العملاء
- **الإشعارات**: نظام إشعارات متكامل
- **الإعدادات**: إعدادات المطعم وساعات العمل
- **استيراد بالذكاء الاصطناعي**: تحليل صور القائمة تلقائياً

### صفحة العميل
- عرض جميل للقائمة
- فلترة حسب الفئات
- سلة تسوق تفاعلية
- عرض العروض الخاصة
- تصميم متجاوب للموبايل

## 🚀 خطوات النشر

### 1. إعداد Firebase Realtime Database

1. أنشئ مشروع جديد على [Firebase Console](https://console.firebase.google.com/)
2. فعّل **Realtime Database**
3. حدد قواعد الأمان (للتطوير):
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
4. انسخ عنوان قاعدة البيانات

### 2. نشر Cloudflare Worker

#### تثبيت Wrangler CLI
```bash
npm install -g wrangler
```

#### تسجيل الدخول
```bash
wrangler login
```

#### إعداد المتغيرات البيئية
```bash
wrangler secret put FIREBASE_DB_URL
# أدخل: https://your-project-default-rtdb.firebaseio.com

wrangler secret put MISTRAL_API_KEY
# أدخل: مفتاح Mistral API

wrangler secret put GEMINI_API_KEY
# أدخل: مفتاح Google Gemini API

wrangler secret put QWEN_API_KEY
# أدخل: مفتاح Qwen API (اختياري)
```

#### النشر
```bash
cd mezomenu-html
wrangler deploy
```

### 3. نشر الموقع الثابت

#### الخيار أ: GitHub Pages
1. ارفع مجلد المشروع إلى GitHub
2. فعّل GitHub Pages من Settings > Pages
3. اختر المصدر: main branch / root

#### الخيار ب: Cloudflare Pages
1. اذهب إلى Cloudflare Dashboard > Pages
2. Connect to Git repository
3. اختر Build command: (فارغ) أو `echo "No build needed"`
4. اختر Output directory: `/` أو `.`
5. Deploy!

#### الخيار ج: Netlify
1. اسحب وأفلت مجلد المشروع في [Netlify Drop](https://app.netlify.com/drop)

### 4. تهيئة R2 للتخزين (اختياري)

1. أنشئ R2 Bucket من Cloudflare Dashboard
2. فعّل Public Access
3. أضف Binding في wrangler.toml:
```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-bucket-name"
```

## 🔧 تكوين API Keys

### Mistral AI (OCR + LLM)
- سجل في [Mistral AI](https://console.mistral.ai/)
- احصل على API Key
- يدعم OCR عالي الجودة + تحليل النصوص

### Google Gemini 2.5 Flash Vision
- سجل في [Google AI Studio](https://aistudio.google.com/)
- احصل على API Key
- دع رؤية الصور مباشرة

### Qwen2.5-VL (Alibaba) - بديل
- سجل في [Alibaba Cloud](https://dashscope.console.aliyun.com/)
- احصل على API Key
- خيار احتياطي ممتاز

## 🔄 نظام الذكاء الاصطناعي

النظام يستخدم pipeline متعدد المراحل:

1. **Mistral OCR** → استخراج النص من الصورة
2. **Mistral LLM** → تحويل النص لبيانات منظمة JSON
3. **Gemini 2.5 Flash** → بديل (رؤية + تحليل)
4. **Qwen2.5-VL** → بديل أخير

### ضغط الصور قبل الإرسال:
- الحد الأقصى: 1024 بكسل
- الجودة: 85% JPEG
- يقلل حجم الملف ويحسن السرعة

## 📱 استخدام التطبيق

### للوحة الإدارة:
افتح `index.html` بعد رفع الموقع

### لصفحة العميل:
افتح `customer/index.html`

## 🛠️ التقنيات المستخدمة

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Database**: Firebase Realtime Database (REST API)
- **Backend**: Cloudflare Workers (Serverless)
- **Storage**: Cloudflare R2 (اختياري)
- **AI**: Mistral, Google Gemini, Qwen2.5-VL
- **Icons**: Font Awesome 6
- **Design**: RTL Arabic Support, Responsive

## 📄 الرخصة

هذا المشروع للاستخدام الشخصي والتجاري.

## 🆘 الدعم

للمساعدة أو الاستفسارات، راجع التوثيق أو افت Issue.
