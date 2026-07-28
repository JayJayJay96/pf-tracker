import { createAuthConfirmHandler } from '../../../src/lib/auth/confirm-route';
import { createClient } from '../../../src/lib/supabase/server';

export const GET = createAuthConfirmHandler(createClient);
