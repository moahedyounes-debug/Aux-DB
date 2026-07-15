# خطة إكمال الصفحات المتبقية ببيانات حقيقية

## الوضع الحالي بعد الفحص

الصفحات المُفعّلة من شيت الطلبات الحالي فعلاً موجودة ومكتوبة (Daily Ops, Pending, Deep Insights, Call Center, Installation, ASC Performance) — فقط **City Breakdown** ناقصة.
الباقي (18 صفحة) لا يزال "Coming Soon".

## الشيتات الإضافية المتوفرة (تم فحصها)

1. **شيت Calls** — يحتوي: `Calls` (5.1K سطر مكالمات)، `WhatsApp Uniqe` (2.1K)، `WhatsApp Agents` (تجميعي شهري)، `Creation`، `Calls Summary`.
2. **شيت CIC Evaluation** — يحتوي: `Evaluation Form` (تقييم موظفين بعدة معايير 1-5)، `Final Score` (النتيجة الموزونة)، `Comments`.

## الصفحات اللي بنبنيها فعلياً (8 صفحات)

### أ. من شيت الطلبات الحالي (5)
```text
1. City Breakdown          — الناقصة الوحيدة من المفعّلات
2. OBM Analysis            — تحليل أداء OBM (فروع/مناطق × SLA)
3. Ticket Repair History   — سجل كامل قابل للبحث + فلاتر
4. Rejected / Returned     — التذاكر الملغاة/المرفوضة + الأسباب
```

### ب. من شيت Calls الجديد (3)
```text
5. Call Events             — 5K مكالمة: SLA%، Answered/Abandoned، Peak Hours، Agent perf
6. WhatsApp                — WhatsApp Uniqe + Agents: حجم، ART/AFT، أداء موظف
7. Call Center Assignment  — تحميل الموظفين من Creation + Calls
```

### ج. من شيت CIC Evaluation (1)
```text
8. Satisfaction            — Final Score و Evaluation Form: نقاط الموظفين، الأقسام، تعليقات
```

## البنية التقنية

- إضافة `AUX_CALLS_SPREADSHEET_ID` و `AUX_CIC_SPREADSHEET_ID` في `sheets.functions.ts`.
- إضافة server functions جديدة:
  - `getCallsSnapshot()` — يقرأ Calls + WhatsApp Uniqe + WhatsApp Agents، يرجّع summary + rows.
  - `getCICSnapshot()` — يقرأ Evaluation Form + Final Score + Comments، يرجّع Agent scores.
- كل واحد بـ `queryOptions` مستقل + `staleTime` معقول (10 دقايق) عشان ما نستهلك quota جوجل.
- كل صفحة: `KpiCards` + 2 ChartCards + جدول + Export CSV (نفس نمط Warranty Payments).

## ما هو خارج النطاق الآن

الصفحات الإدارية الخالصة (Control Panel, Access, Activity Log, Export Center, Custom Dashboard) والصفحات المحتاجة مصادر ما زلت بدون بيانات (Spare Parts, Shipments, Costs, Districts Map, Commerce Complaints) — تبقى Coming Soon لحد ما تحدد لها مصدر أو منطق أعمال.

## التسلسل

1. City Breakdown (سريعة — نفس الشيت الحالي).
2. OBM / Ticket History / Rejected (مشتقة من نفس الشيت).
3. طبقة Calls sheet → Call Events + WhatsApp + Assignment.
4. طبقة CIC sheet → Satisfaction.

بعد الموافقة أبدأ بالتنفيذ. لو حابب أشيل/أضيف صفحة من الـ 8 قبل ما نبدأ، قل لي الحين.