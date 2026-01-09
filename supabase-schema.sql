-- ============================================
-- Supabase Schema for The Setter App
-- Instagram DM Management Platform
-- ============================================

-- ============================================
-- 1. ACCOUNTS TABLE
-- Stores connected Instagram/Facebook accounts
-- ============================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- OAuth tokens
  access_token TEXT NOT NULL,
  page_token TEXT,                    -- Facebook Page token (for Facebook Login flow)
  
  -- Account identifiers
  instagram_id TEXT,                  -- Instagram Business Account ID
  page_id TEXT,                       -- Facebook Page ID
  username TEXT,                      -- Instagram username
  
  -- Metadata
  platform TEXT DEFAULT 'instagram',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each user can only have one account connected
  UNIQUE(user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_instagram_id ON public.accounts(instagram_id);

-- ============================================
-- 2. MESSAGES TABLE
-- Stores webhook messages from Instagram
-- ============================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Message identifiers
  instagram_message_id TEXT,          -- Original message ID from Instagram
  conversation_id TEXT,               -- Conversation/thread ID
  
  -- Sender/receiver info
  sender_id TEXT NOT NULL,
  sender_username TEXT,
  recipient_id TEXT,
  recipient_username TEXT,
  
  -- Message content
  message TEXT,
  message_type TEXT DEFAULT 'text',   -- text, image, video, story_mention, etc.
  media_url TEXT,                     -- URL for media attachments
  
  -- Story mention specific
  story_id TEXT,
  story_url TEXT,
  
  -- Timestamps
  instagram_timestamp TIMESTAMPTZ,    -- When message was sent on Instagram
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Link to account
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Optional: Link to cached conversation (if using conversations table)
  -- conversation_ref_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  
  -- Prevent duplicate messages
  UNIQUE(instagram_message_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_account_id ON public.messages(account_id);

-- ============================================
-- 3. CONVERSATIONS TABLE (Optional)
-- Cache conversation metadata
-- ============================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  instagram_conversation_id TEXT UNIQUE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Participant info
  participant_id TEXT,
  participant_username TEXT,
  participant_name TEXT,
  participant_profile_pic TEXT,
  
  -- Metadata
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_account_id ON public.conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- Ensure users can only see their own data
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Accounts: Users can only CRUD their own accounts
CREATE POLICY "Users can view own accounts" 
  ON public.accounts FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" 
  ON public.accounts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" 
  ON public.accounts FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" 
  ON public.accounts FOR DELETE 
  USING (auth.uid() = user_id);

-- Messages: Users can view messages for their accounts
CREATE POLICY "Users can view own messages" 
  ON public.messages FOR SELECT 
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own messages" 
  ON public.messages FOR INSERT 
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

-- Conversations: Users can view their own conversations
CREATE POLICY "Users can view own conversations" 
  ON public.conversations FOR SELECT 
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own conversations" 
  ON public.conversations FOR INSERT 
  WITH CHECK (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own conversations" 
  ON public.conversations FOR UPDATE 
  USING (
    account_id IN (
      SELECT id FROM public.accounts WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- 5. SERVICE ROLE POLICY FOR WEBHOOKS
-- Allow webhook endpoint to insert messages
-- ============================================

-- Create a policy for service role (webhooks)
-- This allows the API route to insert messages using the service role key
CREATE POLICY "Service role can insert messages"
  ON public.messages FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert conversations"
  ON public.conversations FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update conversations"
  ON public.conversations FOR UPDATE
  TO service_role
  USING (true);

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for accounts table
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for conversations table
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. ENABLE REALTIME
-- For live message updates in the dashboard
-- ============================================

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================
-- DONE! Your database is ready.
-- ============================================
