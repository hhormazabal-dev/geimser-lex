import { chromium, FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');

  // Initialize Supabase client for test data setup
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ Supabase credentials not found. Skipping database setup.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Clean up existing test data
    console.log('🧹 Cleaning up existing test data...');
    
    await supabase
      .from('cases')
      .delete()
      .like('numero_causa', '%E2E%');

    await supabase
      .from('profiles')
      .delete()
      .like('email', '%@test.com');

    // Create test users
    console.log('👥 Creating test users...');
    
    const testUsers = [
      {
        email: 'admin@lexser.com',
        password: 'admin123',
        role: 'admin_firma',
        nombre: 'Admin Test',
        telefono: '+56912345678',
      },
      {
        email: 'abogado@lexser.com',
        password: 'password123',
        role: 'abogado',
        nombre: 'Abogado Test',
        telefono: '+56912345679',
      },
      {
        email: 'cliente@lexser.com',
        password: 'client123',
        role: 'cliente',
        nombre: 'Cliente Test',
        telefono: '+56912345680',
      },
    ];

    for (const user of testUsers) {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (authError) {
        console.error(`Error creating auth user ${user.email}:`, authError);
        continue;
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: user.email,
          role: user.role,
          nombre: user.nombre,
          telefono: user.telefono,
        });

      if (profileError) {
        console.error(`Error creating profile for ${user.email}:`, profileError);
      } else {
        console.log(`✅ Created test user: ${user.email}`);
      }
    }

    // Create test cases
    console.log('📁 Creating test cases...');
    
    // Get the lawyer user ID
    const { data: lawyerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'abogado@lexser.com')
      .single();

    if (lawyerProfile) {
      const testCases = [
        {
          caratulado: 'Test Case 1 vs Defendant 1',
          numero_causa: 'C-2024-E2E-TEST-001',
          materia: 'Civil',
          tribunal: 'Juzgado Civil de Santiago',
          nombre_cliente: 'Cliente Test 1',
          rut_cliente: '12345678-5',
          fecha_inicio: '2024-01-15',
          estado: 'activo',
          prioridad: 'media',
          abogado_responsable: lawyerProfile.id,
        },
        {
          caratulado: 'Test Case 2 vs Defendant 2',
          numero_causa: 'C-2024-E2E-TEST-002',
          materia: 'Laboral',
          tribunal: 'Juzgado Laboral de Santiago',
          nombre_cliente: 'Cliente Test 2',
          rut_cliente: '87654321-6',
          fecha_inicio: '2024-02-01',
          estado: 'suspendido',
          prioridad: 'alta',
          abogado_responsable: lawyerProfile.id,
        },
      ];

      for (const testCase of testCases) {
        const { error } = await supabase
          .from('cases')
          .insert(testCase);

        if (error) {
          console.error('Error creating test case:', error);
        } else {
          console.log(`✅ Created test case: ${testCase.numero_causa}`);
        }
      }
    }

    // Create test documents and notes for the cases
    console.log('📄 Creating test documents and notes...');
    
    const { data: testCases } = await supabase
      .from('cases')
      .select('id')
      .like('numero_causa', '%E2E-TEST%');

    if (testCases && testCases.length > 0) {
      const caseId = testCases[0].id;

      // Create test document
      await supabase
        .from('case_documents')
        .insert({
          case_id: caseId,
          nombre: 'Test Document.pdf',
          descripcion: 'Test document for E2E testing',
          tipo_documento: 'contrato',
          visible_cliente: true,
          archivo_url: 'https://example.com/test.pdf',
          archivo_size: 1024000,
          archivo_type: 'application/pdf',
          uploaded_by: lawyerProfile?.id,
        });

      // Create test note
      await supabase
        .from('case_notes')
        .insert({
          case_id: caseId,
          titulo: 'Test Note',
          contenido: 'This is a test note for E2E testing',
          es_privada: false,
          categoria: 'general',
          created_by: lawyerProfile?.id,
        });

      // Create test stage
      await supabase
        .from('case_stages')
        .insert({
          case_id: caseId,
          etapa: 'Demanda',
          descripcion: 'Presentación de demanda',
          fecha_programada: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          estado: 'pendiente',
          es_publica: true,
          orden: 1,
          created_by: lawyerProfile?.id,
        });

      console.log('✅ Created test documents, notes, and stages');
    }

    // Setup browser state for authenticated sessions
    console.log('🌐 Setting up browser authentication state...');
    
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as lawyer and save state
    await page.goto(process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000');
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'abogado@lexser.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    // Save authenticated state
    await page.context().storageState({ path: 'tests/auth-states/lawyer.json' });

    // Login as admin and save state
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@lexser.com');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
    
    await page.context().storageState({ path: 'tests/auth-states/admin.json' });

    await browser.close();

    console.log('✅ Global setup completed successfully');

  } catch (error) {
    console.error('❌ Error in global setup:', error);
    throw error;
  }
}

export default globalSetup;
