import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (user) {
    // Si el usuario está autenticado, redirigir al dashboard
    redirect('/dashboard');
  } else {
    // Si no está autenticado, redirigir al login
    redirect('/login');
  }
}
