# Moku Pet Admin MVP

Web App สำหรับร้านอาบน้ำสัตว์เลี้ยงและโรงแรมสัตว์เลี้ยง โดยใช้ Next.js + Supabase เน้นใช้งานจริงสำหรับพนักงานหน้าร้านก่อน และออกแบบแบบ mobile-first

## 1. System Design

### 1.1 ภาพรวมระบบ

- Frontend ใช้ Next.js App Router
- Auth และ Database ใช้ Supabase
- Business logic หลักอยู่ที่ Server Actions
- ตารางรายวัน, เช็คคิวชน และเช็คห้องว่าง ใช้ PostgreSQL query/function โดยตรง
- เป้าหมาย MVP คือเปิดมือถือแล้วกดสร้างคิว, เช็กคิววันนี้, เช็กห้องว่าง และเปลี่ยนสถานะได้ในไม่กี่คลิก

### 1.2 User Roles

- `admin`
  - จัดการข้อมูลทุกอย่าง
  - ดู dashboard ทั้งระบบ
  - จัดการห้อง, ราคา, บริการ, staff
- `staff`
  - สร้าง/แก้ไข/ยกเลิก booking
  - ดูตารางคิวรายวัน
  - เช็กห้องว่างและเช็กอิน/เช็กเอาต์
  - จัดการลูกค้าและสัตว์เลี้ยง

### 1.3 ฟีเจอร์ MVP

- Login ด้วย Supabase Auth
- จัดการลูกค้า (`customers`)
- จัดการสัตว์เลี้ยง (`pets`)
- จัดการบริการ (`services`)
- จัดการห้องพัก (`rooms`)
- สร้าง booking แบบอาบน้ำ/ตัดขน
- สร้าง booking แบบโรงแรม
- รองรับหลายบริการใน booking เดียวผ่าน `booking_items`
- เปลี่ยนสถานะ booking: `pending`, `confirmed`, `in_progress`, `done`, `cancelled`
- ดูตารางคิวรายวัน
- เช็คคิวชนก่อนบันทึก
- เช็คห้องว่างก่อนจองโรงแรม

## 2. Database Design

ไฟล์ schema อยู่ที่ [supabase/schema.sql](/C:/MokuPetAdmin/supabase/schema.sql) และ seed data อยู่ที่ [supabase/seed.sql](/C:/MokuPetAdmin/supabase/seed.sql)

### 2.1 ตารางหลัก

- `app_users` เก็บ role ของผู้ใช้จริงในระบบ
- `customers` ข้อมูลเจ้าของสัตว์เลี้ยง
- `pets` ข้อมูลสัตว์เลี้ยง
- `services` บริการอาบน้ำ/ตัดขน/เสริม
- `rooms` ห้องพักสัตว์เลี้ยง
- `bookings` รายการจองหลัก
- `booking_items` รายละเอียดบริการย่อยใน booking

### 2.2 จุดที่กันข้อมูลผิด

- เบอร์โทรลูกค้าซ้ำไม่ได้
- วันเวลา `end_at` ต้องมากกว่า `start_at`
- `hotel` booking ต้องมี `room_id`
- `grooming` booking ห้ามมี `room_id`
- จำนวนสัตว์สูงสุดในห้องต้องมากกว่า 0
- ราคาบริการต้องไม่ติดลบ
- ป้องกันห้องซ้อนด้วย exclusion constraint

## 3. Business Logic

### 3.1 การจองอาบน้ำ

1. พนักงานเลือกสัตว์เลี้ยงและบริการ
2. ระบบรวมเวลาโดยประมาณจาก `booking_items`
3. ระบบคำนวณ `start_at` และ `end_at`
4. ก่อนบันทึก ให้เช็ก booking grooming ที่ยัง active ในช่วงเวลาเดียวกัน
5. ถ้าชน ให้แจ้งเวลาชนทันที

หมายเหตุ: MVP นี้ใช้แนวคิด "จำกัดคิว grooming ซ้อนตามจำนวนโต๊ะ/ช่างที่กำหนดใน query" แทนการสร้างระบบ resource scheduling ซับซ้อน

### 3.2 การจองโรงแรม

1. พนักงานกรอกวัน check-in และ check-out
2. ระบบเรียก `get_available_rooms`
3. แสดงเฉพาะห้องที่ไม่ชนกับ booking hotel อื่น
4. เมื่อเลือกห้องแล้วค่อยบันทึก booking

### 3.3 การเปลี่ยนสถานะ booking

- `pending` เมื่อเพิ่งสร้าง
- `confirmed` เมื่อลูกค้ายืนยัน
- `in_progress` เมื่อนำสัตว์เข้าบริการหรือเช็กอินแล้ว
- `done` เมื่อเสร็จงานหรือเช็กเอาต์เรียบร้อย
- `cancelled` เมื่อลูกค้ายกเลิก

กติกา MVP:

- booking ที่ `done` และ `cancelled` ถือว่าไม่ block ทรัพยากร
- booking ที่เป็น hotel สามารถ set `check_in_at` และ `check_out_at` ได้

### 3.4 ตารางคิวรายวัน

ให้ดึง booking ที่มีช่วงเวลาทับกับวันนั้น แล้ว sort ตาม `start_at`

## 4. API / Server Actions

ตัวอย่างอยู่ใน:

- [app/actions/bookings.ts](/C:/MokuPetAdmin/app/actions/bookings.ts)
- [app/actions/customers.ts](/C:/MokuPetAdmin/app/actions/customers.ts)

Server Actions หลัก:

- `createBooking`
- `updateBooking`
- `cancelBooking`
- `getDailySchedule`
- `getAvailableRooms`

## 5. Frontend Design

### 5.1 Dashboard

- การ์ดสรุปวันนี้: คิวทั้งหมด, grooming วันนี้, hotel กำลังพัก, ห้องว่าง
- ปุ่มลัดใหญ่ 4 ปุ่ม
  - สร้างคิว
  - ตารางวันนี้
  - ลูกค้า
  - ห้องพัก

### 5.2 Daily Schedule

หน้านี้สำคัญที่สุด และควรเปิดใช้งานได้บนมือถือใน 1-2 คลิก

- แถบเลือกวันที่ด้านบน
- ปุ่มสร้าง booking ชัดเจน
- แสดงรายการคิวเป็น card ใหญ่
- แต่ละ card มี:
  - เวลา
  - ชื่อลูกค้า
  - ชื่อสัตว์
  - ประเภท booking
  - status สีชัด
  - ปุ่มเปลี่ยนสถานะเร็ว

### 5.3 Create Booking

- เริ่มจากเลือกประเภท `grooming` หรือ `hotel`
- ฟอร์มแสดงเฉพาะ field ที่เกี่ยวข้อง
- ใช้ปุ่มใหญ่, input สูง, ลดการกรอกซ้ำ
- ถ้าเป็น hotel ให้กดเช็คห้องว่างก่อนแล้วค่อยเลือกห้อง

### 5.4 Customers / Pets / Rooms

- list + ปุ่มเพิ่มข้อมูลด้านบน
- card view สำหรับมือถือ
- ใช้ search ทีหลังใน Phase 2 ได้

## 6. UI/UX Requirements

- ปุ่มสูงอย่างน้อย 44px
- สี status ชัดเจน
  - `pending` เหลือง
  - `confirmed` น้ำเงิน
  - `in_progress` ส้ม
  - `done` เขียว
  - `cancelled` แดง
- action สำคัญอยู่มุมล่างหรือบนที่เอื้อมง่าย
- ลด field ที่ไม่จำเป็น
- ใช้ภาษาไทยทั้งหมด

## 7. Project Structure

```text
app/
  actions/
  bookings/new/
  customers/
  pets/
  rooms/
  schedule/
  layout.tsx
  page.tsx
components/
  forms/
  ui/
lib/
  bookings.ts
  format.ts
  supabase/
supabase/
  schema.sql
  seed.sql
types/
  database.ts
```

## 8. Step-by-Step เริ่มใช้งาน

ก่อนเริ่ม แนะนำให้ใช้ Node.js `20.19.0` ขึ้นไป

1. สร้างโปรเจกต์ Supabase
2. เปิด SQL editor แล้วรัน [schema.sql](/C:/MokuPetAdmin/supabase/schema.sql)
3. รันไฟล์ใน `supabase/migrations` ตามลำดับชื่อไฟล์ เพื่อให้ function และ performance index ตรงกับ application version
4. รัน [seed.sql](/C:/MokuPetAdmin/supabase/seed.sql)
5. ตั้งค่า `.env.local` จาก [.env.example](/C:/MokuPetAdmin/.env.example)
6. ติดตั้ง package ด้วย `npm install`
7. รัน `npm run dev`
8. เริ่มใช้งานที่หน้า Schedule และ Create Booking ก่อน

## 9. Development Plan

### Phase 1: MVP

- login
- customers / pets / rooms / services CRUD พื้นฐาน
- create / update / cancel booking
- daily schedule
- available rooms
- status update แบบเร็ว

### Phase 2: เพิ่มฟีเจอร์

- ค้นหาลูกค้า/สัตว์
- filter ตาม status
- แจ้งเตือนคิวใกล้ถึงเวลา
- บันทึกการชำระเงิน
- รูปสัตว์เลี้ยง
- ประวัติการเข้ารับบริการ

### Phase 3: Scale

- หลายสาขา
- หลายช่างพร้อม resource scheduler จริง
- รายงานรายได้
- inventory สินค้า
- audit log
- RBAC ละเอียดขึ้น

## 10. แนวคิดสำคัญ

- อย่า over-engineer
- แยก `grooming` กับ `hotel` ให้ชัดใน business rules
- ใช้ SQL/function ช่วยเช็ก conflict เพื่อให้ frontend ง่าย
- ให้พนักงานกดน้อยที่สุดและเห็นสถานะได้ทันที
