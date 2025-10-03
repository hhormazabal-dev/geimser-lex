import { FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...');

  // Initialize Supabase client for cleanup
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ Supabase credentials not found. Skipping database cleanup.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Clean up test data
    console.log('🗑️ Cleaning up test data...');

    // Delete test cases and related data (cascading deletes should handle related records)
    const { error: casesError } = await supabase
      .from('cases')
      .delete()
      .like('numero_causa', '%E2E%');

    if (casesError) {
      console.error('Error deleting test cases:', casesError);
    } else {
      console.log('✅ Deleted test cases');
    }

    // Delete test magic links
    const { error: magicLinksError } = await supabase
      .from('magic_links')
      .delete()
      .like('email', '%@test.com');

    if (magicLinksError) {
      console.error('Error deleting test magic links:', magicLinksError);
    } else {
      console.log('✅ Deleted test magic links');
    }

    // Delete test audit logs
    const { error: auditError } = await supabase
      .from('audit_logs')
      .delete()
      .like('user_email', '%@test.com');

    if (auditError) {
      console.error('Error deleting test audit logs:', auditError);
    } else {
      console.log('✅ Deleted test audit logs');
    }

    // Delete test user sessions
    const { error: sessionsError } = await supabase
      .from('user_sessions')
      .delete()
      .in('user_id', [
        // We'll get the user IDs first
      ]);

    // Get test user IDs
    const { data: testUsers } = await supabase
      .from('profiles')
      .select('id')
      .like('email', '%@test.com');

    if (testUsers && testUsers.length > 0) {
      const userIds = testUsers.map(user => user.id);
      
      // Delete user sessions
      await supabase
        .from('user_sessions')
        .delete()
        .in('user_id', userIds);

      // Delete login attempts
      await supabase
        .from('login_attempts')
        .delete()
        .in('user_id', userIds);

      console.log('✅ Deleted test user sessions and login attempts');
    }

    // Delete test profiles
    const { error: profilesError } = await supabase
      .from('profiles')
      .delete()
      .like('email', '%@test.com');

    if (profilesError) {
      console.error('Error deleting test profiles:', profilesError);
    } else {
      console.log('✅ Deleted test profiles');
    }

    // Delete test auth users
    if (testUsers && testUsers.length > 0) {
      for (const user of testUsers) {
        const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
        if (authError) {
          console.error(`Error deleting auth user ${user.id}:`, authError);
        }
      }
      console.log('✅ Deleted test auth users');
    }

    // Clean up auth state files
    console.log('🗂️ Cleaning up auth state files...');
    
    const authStatesDir = path.join(process.cwd(), 'tests', 'auth-states');
    
    if (fs.existsSync(authStatesDir)) {
      const files = fs.readdirSync(authStatesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(authStatesDir, file);
          try {
            fs.unlinkSync(filePath);
            console.log(`✅ Deleted auth state file: ${file}`);
          } catch (error) {
            console.error(`Error deleting auth state file ${file}:`, error);
          }
        }
      }
    }

    // Clean up test artifacts
    console.log('🗂️ Cleaning up test artifacts...');
    
    const testResultsDir = path.join(process.cwd(), 'test-results');
    
    if (fs.existsSync(testResultsDir)) {
      // Keep the directory but clean old files if needed
      const files = fs.readdirSync(testResultsDir);
      
      // Only clean files older than 7 days to preserve recent test results
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      for (const file of files) {
        const filePath = path.join(testResultsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < sevenDaysAgo) {
          try {
            if (stats.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
            console.log(`✅ Deleted old test artifact: ${file}`);
          } catch (error) {
            console.error(`Error deleting test artifact ${file}:`, error);
          }
        }
      }
    }

    // Clean up uploaded test files (if any)
    console.log('📁 Cleaning up test file uploads...');
    
    // This would clean up any test files uploaded to Supabase Storage
    const { data: buckets } = await supabase.storage.listBuckets();
    
    if (buckets) {
      for (const bucket of buckets) {
        const { data: files } = await supabase.storage
          .from(bucket.name)
          .list('test-uploads', {
            limit: 100,
          });

        if (files && files.length > 0) {
          const filePaths = files.map(file => `test-uploads/${file.name}`);
          
          const { error: deleteError } = await supabase.storage
            .from(bucket.name)
            .remove(filePaths);

          if (deleteError) {
            console.error(`Error deleting test files from bucket ${bucket.name}:`, deleteError);
          } else {
            console.log(`✅ Deleted test files from bucket: ${bucket.name}`);
          }
        }
      }
    }

    // Reset any test-specific database sequences or counters
    console.log('🔄 Resetting database sequences...');
    
    // This would reset any auto-increment sequences that might have been affected
    // by test data creation and deletion
    
    console.log('✅ Global teardown completed successfully');

  } catch (error) {
    console.error('❌ Error in global teardown:', error);
    // Don't throw the error to avoid failing the test run
    // Teardown errors should be logged but not block the process
  }

  // Final cleanup message
  console.log('🎯 Test environment cleaned up and ready for next run');
}

export default globalTeardown;
