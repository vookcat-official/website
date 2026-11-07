# vookcat web

เว็บ Next.js สำหรับหน้าไลฟ์ สมาชิก และการจัดการข้อมูล โดยใช้ MongoDB เป็นที่เก็บข้อมูล

## ตั้งค่า MongoDB

1. สร้าง MongoDB database (เช่น MongoDB Atlas) และกำหนด `MONGODB_URL` ใน `.env` เป็น connection string โดยใส่ชื่อฐานข้อมูลใน URL เช่น `mongodb+srv://<user>:<password>@<cluster>/vookcat`
3. ตั้ง `SESSION_SECRET` เป็น secret แบบสุ่มที่ยาวและคาดเดายาก
4. ตั้ง `EASYDONATE_API_KEY` เป็น API key จาก EasyDonate ที่มี scope `read:widgets` หากต้องการแสดง Donate Timer และ Leaderboard (เป็น optional)

อย่าใส่ prefix `NEXT_PUBLIC_` ให้กับค่าเหล่านี้ และอย่า commit `.env` ค่า `SESSION_SECRET` สร้างได้ด้วย `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` หลังแก้ `.env` ให้รีสตาร์ตเซิร์ฟเวอร์ Next.js ใน production ให้ตั้งค่าตัวแปรเดียวกันใน Environment Variables ของ deployment โดยใช้ MongoDB URL ของ production

ระบบใช้ MongoDB เป็นแหล่งเก็บข้อมูลหลัก ผ่าน collections `users`, `settings`, `replays` และ `sessions` พร้อมสร้างค่า setting เริ่มต้นและ indexes ให้อัตโนมัติ

ผู้ใช้สมัครบัญชีจากหน้าเข้าสู่ระบบได้ โดยบัญชีใหม่จะได้ Role `user` และเห็นหน้าแรกกับคลิปย้อนหลังฟรี แอดมินเลือกได้ตอนเพิ่มคลิปว่าจะให้ดูฟรีหรือเฉพาะสมาชิก แอดมินสามารถกำหนด Role เป็น `member` เพื่อให้มีแท็บสมาชิก หรือ `admin` เพื่อให้จัดการเว็บได้ แอดมินจัดการ Role ได้จากแท็บจัดการผู้ใช้; ระบบไม่อนุญาตให้เปลี่ยน Role ของบัญชีที่กำลังใช้อยู่ และไม่อนุญาตให้ลดสิทธิ์แอดมินบัญชีสุดท้าย

## เริ่มใช้งาน

```bash
npm run dev
```

จากนั้นเปิด [http://localhost:3000](http://localhost:3000)
