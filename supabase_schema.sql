-- 1. profiles 테이블 생성
CREATE TABLE profiles (
  account_id UUID PRIMARY KEY,
  nickname TEXT NOT NULL,
  team_id TEXT NOT NULL,
  role_type TEXT NOT NULL DEFAULT 'user',
  assigned_team_id TEXT,
  password TEXT,
  account_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 2. wishes 테이블 생성 (보완)
CREATE TABLE wishes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  team_id TEXT NOT NULL,
  name TEXT,
  content TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  author_account_id UUID REFERENCES profiles(account_id) ON DELETE SET NULL,
  owner_deleted BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false
);

-- 3. prayer_messages 테이블 생성 (보완)
CREATE TABLE prayer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  team_id TEXT NOT NULL,
  nickname TEXT,
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  author_account_id UUID REFERENCES profiles(account_id) ON DELETE SET NULL,
  author_team_id TEXT,
  owner_deleted BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false
);

-- 4. support_requests 테이블 생성
CREATE TABLE support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  account_id UUID REFERENCES profiles(account_id) ON DELETE SET NULL,
  nickname TEXT,
  author_team_id TEXT,
  current_space TEXT,
  room_team_id TEXT,
  status TEXT DEFAULT 'new',
  admin_note TEXT,
  handled_by_account_id UUID REFERENCES profiles(account_id) ON DELETE SET NULL
);

-- 5. Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE wishes;
ALTER PUBLICATION supabase_realtime ADD TABLE prayer_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE support_requests;

-- 6. RLS (Row Level Security) 설정
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

-- 7. 정책 (Policies) 설정

-- profiles 정책
CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert profiles" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update profiles" ON profiles FOR UPDATE USING (true) WITH CHECK (true);

-- wishes 정책
CREATE POLICY "Anyone can read wishes" ON wishes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert wishes" ON wishes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update wishes" ON wishes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete wishes" ON wishes FOR DELETE USING (true);

-- prayer_messages 정책
CREATE POLICY "Anyone can read prayer_messages" ON prayer_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert prayer_messages" ON prayer_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update prayer_messages" ON prayer_messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete prayer_messages" ON prayer_messages FOR DELETE USING (true);

-- support_requests 정책
CREATE POLICY "Anyone can insert support_requests" ON support_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read support_requests" ON support_requests FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE account_id = auth.uid() 
    AND role_type IN ('hoejoo', 'josil', 'jooji')
  ) OR (account_id = auth.uid())
);
CREATE POLICY "Admins can update support_requests" ON support_requests FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE account_id = auth.uid() 
    AND role_type IN ('hoejoo', 'josil', 'jooji')
  )
);
