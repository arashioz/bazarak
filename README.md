# bazarak
# bazarak
# انتقال محصولات به MongoDB در Docker

اسکریپت‌های عملیاتی و داده‌های JSON آن‌ها پس از build در کانتینر برنامه در دسترس‌اند. برای انتقال فقط محصولاتِ موجود در `app/data/database.json` به MongoDB اجرا کنید:

```sh
docker compose exec bazarek npm run migrate:products
```

این دستور خودکار اجرا نمی‌شود. اگر محصولی پیش‌تر در MongoDB وجود داشته باشد، تغییرات ثبت‌شدهٔ آن در MongoDB حفظ می‌شود.

# مشاهدهٔ MongoDB با Compass

پس از deploy، از کامپیوتر خود این tunnel را باز نگه دارید (نام کاربر و IP سرور را جایگزین کنید):

```sh
ssh -N -L 27017:127.0.0.1:27017 USER@SERVER_IP
```

سپس این آدرس را در MongoDB Compass وارد کنید:

```text
mongodb://127.0.0.1:27017/bazarek
```
