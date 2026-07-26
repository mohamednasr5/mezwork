# 📖 دليل إعداد Agnes AI API Key

## 🔑 كيفية الحصول على مفتاح API من Agnes AI

### الخطوة 1: التسجيل في Agnes AI
1. اذهب إلى: **https://platform.agnes-ai.com/**
2. سجل حساب جديد أو سجل دخول
3. اذهب إلى قسم **API Keys** أو **المفاتيح**
4. أنشئ مفتاح API جديد
5. انسخ المفتاح (يبدأ عادةً بـ `agnes-` أو `sk-`)

---

## ⚙️ طرق إضافة المفتاح في Worker

### الطريقة 1: عبر Cloudflare Dashboard (الأفضل للإنتاج) ✅

```
1. سجل دخول إلى https://dash.cloudflare.com
2. اذهب إلى → Workers & Pages
3. اختر مشروع MezoMenu Worker
4. اضغط على Settings (الإعدادات)
5. اختر Variables (متغيرات البيئة)
6. أضف متغير جديد:
   ┌─────────────────┬──────────────────────────────┐
   │ الاسم (Name)    │ AGNES_AI_API_KEY             │
   ├─────────────────┼──────────────────────────────┤
   │ القيمة (Value)  │ agnes-xxxxxxxxxxxxxxxxxxxx    │
   └─────────────────┴──────────────────────────────┘
7. اضغط Save (حفظ)
8. أعد نشر Deploy الـ Worker
```

---

### الطريقة 2: عبر Wrangler CLI (للمطورين)

```bash
# 1. تسجيل الدخول
wrangler login

# 2. تعيين المتغير السري
wrangler secret put AGNES_AI_API_KEY

# 3. الصق المفتاح عند الطلب
# Enter secret value: agnes-xxxxxxxxxxxx

# 4. إعادة النشر
wrangler deploy
```

---

### الطريقة 3: عبر ملف `.env` (للتطوير المحلي فقط)

أنشئ ملف `.env` في مجلد المشروع:

```env
# .env file
AGNES_AI_API_KEY=agnes-your-api-key-here
```

**⚠️ تحذير:** لا ترفع ملف `.env` إلى GitHub! أضفه إلى `.gitignore`

---

### الطريقة 4: عبر `wrangler.toml` (غير آمن - للاختبار فقط)

```toml
# wrangler.toml
[vars]
# ⚠️ هذا غير آمن للإنتاج!
AGNES_AI_API_KEY = "your-api-key-here"
```

---

## 🧪 اختبار العمل

### 1. فحص حالة الخدمة
```bash
curl -X GET https://menu.nonm1724.workers.dev/api/ai/status
```

**النتيجة المتوقعة إذا كان المفتاح مضبوطاً:**
```json
{
  "success": true,
  "data": {
    "services": {
      "agnesAI": {
        "available": true,
        "configured": true,
        "baseUrl": "https://platform.agnes-ai.com/api"
      }
    },
    "primaryService": "agnes-ai",
    "recommendation": "✅ Agnes AI is configured and ready!"
  }
}
```

---

### 2. اختبار المحادثة (Chat)
```bash
curl -X POST https://menu.nonm1724.workers.dev/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "حلل هذه القائمة: بيتزا 80 ج.م، برجر 60 ج.م",
    "options": {"language": "ar"}
  }'
```

---

### 3. اختبار توليد الصور
```bash
curl -X POST https://menu.nonm1724.workers.dev/api/ai/image \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "بيتزا إيطالية مع جبن ومشروم",
    "options": {"width": 512, "height": 512}
  }'
```

---

## 🐛 استكشاف الأخطاء وإصلاحها

### المشكلة: `"Agnes AI API key not configured"`

**الحل:** تأكد من إضافة المفتاح بشكل صحيح في Cloudflare Dashboard

---

### المشكلة: `"401 Unauthorized"` أو `"Invalid API Key"`

**الحل:**
1. تأكد من نسخ المفتاح كاملاً بدون مسافات
2. تأكد من أن المفتاح نشط وغير منتهي الصلاحية
3. جرب إنشاء مفتاح جديد من لوحة تحكم Agnes AI

---

### المشكلة: `"503 Service Unavailable"`

**الحل:**
1. تحقق من حالة خادم Agnes AI
2. تأكد من صحة الرابط (`baseUrl`) في الإعدادات
3. تواصل مع دعم Agnes AI

---

## 📋 قائمة جميع المتغيرات المتاحة

| المتغير | الوصف | ضروري؟ |
|---------|-------|--------|
| `AGNES_AI_API_KEY` | مفتاح API الأساسي | ✅ نعم |
| `GOOGLE_VISION_API_KEY` | مفتاح Google Vision (بديل OCR) | ❌ لا |
| `UNSPLASH_ACCESS_KEY` | مفتاح Unsplash (صور حقيقية) | ❌ no |
| `HUGGINGFACE_API_KEY` | مفتاح Hugging Face (توليد صور) | ❌ لا |

---

## 🔄 الفallback (البديل)

إذا لم يتم إضافة `AGNES_AI_API_KEY`:
- سيتم استخدام **Google Vision** لـ OCR (إذا كان متاحاً)
- سيتم استخدام **Unsplash** للصور (إذا كان متاحاً)
- سيتم إنشاء **صور تمثيلية** كحل أخير

---

## 📞 الدعم

إذا واجهت أي مشاكل:
1. تحقق من [لوحة تحكم Agnes AI](https://platform.agnes-ai.com/)
2. راجع توثيق API الخاص بهم
3. تواصل معنا للمساعدة

---

**✅ بعد إضافة المفتاح، أعد نشر Worker ليصبح سارياً!**
