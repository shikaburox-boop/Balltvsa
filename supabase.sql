-- รันไฟล์นี้ใน Supabase: SQL Editor → New query → วาง → Run
-- สร้างตารางเก็บเส้น/รูปทรง/ข้อความบนกระดาน (ส่วนเรียลไทม์ใช้ Broadcast ไม่ต้องตั้งค่าเพิ่ม)

create table if not exists public.strokes (
  id         text primary key check (char_length(id) <= 40),
  board      text not null check (char_length(board) between 1 and 40),
  z          bigint not null,
  data       jsonb not null check (pg_column_size(data) < 900000),
  author     text,
  updated_at timestamptz not null default now()
);

create index if not exists strokes_board_z_idx on public.strokes (board, z);

alter table public.strokes enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.strokes to anon, authenticated;

-- ใครก็อ่าน/วาด/ลบได้ (กระดานสาธารณะ) ถ้าอยากจำกัดสิทธิ์ ให้เปลี่ยนนโยบายด้านล่าง
drop policy if exists "strokes read"   on public.strokes;
drop policy if exists "strokes insert" on public.strokes;
drop policy if exists "strokes update" on public.strokes;
drop policy if exists "strokes delete" on public.strokes;

create policy "strokes read"   on public.strokes for select to anon, authenticated using (true);
create policy "strokes insert" on public.strokes for insert to anon, authenticated with check (true);
create policy "strokes update" on public.strokes for update to anon, authenticated using (true) with check (true);
create policy "strokes delete" on public.strokes for delete to anon, authenticated using (true);
