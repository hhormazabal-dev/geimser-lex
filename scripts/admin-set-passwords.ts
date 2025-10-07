// scripts/admin-set-passwords.ts
import 'dotenv/config';

const BASE_URL = process.env.SUPABASE_URL!;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!; // service role
const PASSWORD = process.env.ADMIN_TEMP_PASSWORD || 'Temporal#2025';

const EMAILS = [
  'lpincheirah@geimser.cl',
  'israel.alvarez.huerta@gmail.com',
  'pmelellim@gmail.com',
  'hh2fc24@gmail.com',
];

async function getUserByEmail(email: string) {
  const u = new URL('/auth/v1/admin/users', BASE_URL);
  u.searchParams.set('email', email);
  const res = await fetch(u, {
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  });
  if (!res.ok) throw new Error(`getUserByEmail ${email}: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { users?: any[] } | any[];
  const arr = Array.isArray(data) ? data : data.users ?? [];
  return arr[0] ?? null;
}

async function setPassword(userId: string, password: string) {
  const u = new URL(`/auth/v1/admin/users/${userId}`, BASE_URL);
  const res = await fetch(u, {
    method: 'PATCH',
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`setPassword ${userId}: ${res.status} ${await res.text()}`);
}

async function main() {
  if (!BASE_URL || !SRK) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  console.log('[admin-set-passwords] usando', BASE_URL);
  console.log('[admin-set-passwords] password a aplicar:', PASSWORD.replace(/./g, '*'));

  for (const email of EMAILS) {
    try {
      const user = await getUserByEmail(email);
      if (!user) {
        console.log(`✖ No existe en auth.users: ${email}`);
        continue;
      }
      await setPassword(user.id, PASSWORD);
      console.log(`✔ Password seteada: ${email} (${user.id})`);
    } catch (e: any) {
      console.log(`✖ Error con ${email}:`, e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});