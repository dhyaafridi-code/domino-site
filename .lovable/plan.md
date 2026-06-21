# خطة بناء Tokio Domino 🎲

موقع دومينو أونلاين باسم **Tokio**، بتصميم ليلي عصري (ألوان: كحلي عميق #1a2332، أزرق ليلي #2a3a52، برتقالي ناري #ff7a3d، بنفسجي #a855f7)، يدعم حتى 4 لاعبين في الغرفة الواحدة مع شات حي وحسابات مستخدمين.

## المراحل

### 1. تفعيل Lovable Cloud

لازم لإدارة الحسابات، الغرف الحية، الشات، رفع الصور الشخصية، ومزامنة حالة اللعبة بين اللاعبين (Realtime).

### 2. نظام التصميم

- لوغو مخصص "Tokio" (مولّد كصورة) + favicon
- خطوط: Outfit للعناوين + Figtree للنص
- توكنز ألوان (oklch) في `src/styles.css` متطابقة مع اللوحة المختارة
- تأثيرات: gradients، glows، shadows عميقة، animations سلسة (framer-motion)
- خلفية: نقاط دومينو شفافة كـ pattern

### 3. الشاشات

1. **الصفحة الرئيسية** `/` — Hero مع لوغو Tokio، CTA للعب، شرح مختصر، أزرار "العب الآن" و "إنشاء غرفة"
2. **تسجيل دخول/تسجيل** `/auth` — بريد + كلمة سر (Lovable Cloud)
3. **اللوبي** `/lobby` — قائمة الغرف العامة + زر إنشاء غرفة جديدة
4. **الملف الشخصي** `/profile` — تغيير الاسم ورفع صورة شخصية
5. **غرفة الانتظار** `/room/$id` — قائمة اللاعبين، إعدادات (نمط: All-Fives / Block، عدد اللاعبين 2-4، نقاط الفوز)، زر "جاهز"، رابط دعوة
6. **اللعبة** `/room/$id/play` — رقعة اللعب، يد اللاعب، أيدي الخصوم (مقلوبة)، تايمر الدور، نقاط، شات جانبي

### 4. منطق اللعبة

- توليد طقم 28 حجر دومينو
- توزيع حسب عدد اللاعبين (7 لكل لاعب في 2، 5 لكل لاعب في 3-4)
- اللاعب صاحب أعلى مزدوج يبدأ
- تحقق من شرعية الحركة (تطابق الأرقام مع طرفي السلسلة)
- وضع الحجر يسار/يمين السلسلة
- نمط All-Fives: نقاط = مجموع الأطراف إن كان من مضاعفات 5
- سحب من البنك (Block) أو تخطي الدور
- اكتشاف الفائز/التعادل/إغلاق اللعبة وحساب النقاط
- لعب جولات حتى الوصول لنقاط الفوز

### 5. الواقعي (Realtime)

- جدول `rooms` (id, host, style, max_players, status, winning_score)
- جدول `room_players` (room_id, user_id, seat, is_ready, score)
- جدول `game_state` (room_id, board JSONB, hands JSONB, turn, bone_yard, history)
- جدول `messages` (room_id, user_id, text, created_at)
- جدول `profiles` (user_id, username, avatar_url)
- bucket `avatars` لرفع الصور
- تفعيل Supabase Realtime على هذه الجداول
- RLS مناسب + GRANTs

### 6. ميزات إضافية

- شات حي داخل الغرفة (إيموجي مدعوم)
- إشعارات انضمام/مغادرة لاعبين
- أصوات (اختياري) عند وضع حجر
- متجاوب كامل (موبايل + ديسكتوب)
- متعدد اللغات بسيط (عربي + إنجليزي) — افتراضي عربي RTL

## التفاصيل التقنية

- **Stack**: TanStack Start v1 + React 19 + Tailwind v4 + shadcn
- **Backend**: Lovable Cloud (Supabase) — Auth + Postgres + Realtime + Storage
- **State**: TanStack Query للبيانات، Realtime subscriptions للتحديثات الحية
- **Routes**:
  ```
  src/routes/
    index.tsx              → /
    auth.tsx               → /auth
    _authenticated/
      lobby.tsx            → /lobby
      profile.tsx          → /profile
      room.$id.tsx         → /room/:id (انتظار)
      room.$id.play.tsx    → /room/:id/play
  ```
- **Domino logic**: في `src/lib/domino/` (engine.ts, types.ts) — pure functions قابلة للاختبار
- **Server functions**: `placeTile`, `drawTile`, `passTurn`, `setReady`, `createRoom`, `joinRoom` — مع `requireSupabaseAuth`
- **حماية**: لا يحق للاعب رؤية أيدي الآخرين (server-side filtering)، التحقق من الدور والحركة في server function

## النطاق في هذه الجلسة

سأبني **النسخة الكاملة الأولى**:

- ✅ التصميم + اللوغو + جميع الشاشات
- ✅ Auth + Profiles + رفع صور
- ✅ إنشاء/الانضمام لغرف
- ✅ منطق اللعبة كامل (All-Fives + Block)
- ✅ مزامنة Realtime
- ✅ شات حي
- ✅ دعم 2-4 لاعبين

ميزات قد نؤجلها لتكرار لاحق إن لزم: ranking عالمي، أصدقاء، تاريخ المباريات، صوتيات.

موافق نبدأ؟
