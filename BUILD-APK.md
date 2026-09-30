# بناء APK لتطبيق حافظ القرآن

## الطريقة 1: بدون تثبيت أي شيء (GitHub Actions)
1. أنشئ مستودع جديد على GitHub وارفع محتوى هذا المجلد كله.
2. ادخل تبويب Actions ثم Build APK ثم Run workflow.
3. بعد دقائق نزّل الملف app-debug.apk من Artifacts وثبّته على الموبايل.

## الطريقة 2: على جهازك (يلزم Node 22 و JDK 21 و Android Studio)
    npm install --legacy-peer-deps
    npm run build
    npx cap sync android
    cd android && ./gradlew assembleDebug   # على ويندوز: gradlew.bat assembleDebug

الناتج: android/app/build/outputs/apk/debug/app-debug.apk

ملاحظة: مجلد android-native-stub هو الهيكل القديم (شاشة نصية فقط) وغير مستخدم.
