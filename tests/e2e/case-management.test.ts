import { test, expect, type Page } from '@playwright/test';

// Helper functions for common actions
async function loginAsLawyer(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', 'abogado@xelchile.com');
  await page.fill('[data-testid="password-input"]', 'password123');
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', 'admin@xelchile.com');
  await page.fill('[data-testid="password-input"]', 'admin123');
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

async function createTestCase(page: Page, caseData: {
  caratulado: string;
  numero_causa: string;
  materia: string;
  tribunal: string;
  nombre_cliente: string;
  rut_cliente: string;
}) {
  await page.goto('/cases/new');
  
  await page.fill('[data-testid="caratulado-input"]', caseData.caratulado);
  await page.fill('[data-testid="numero-causa-input"]', caseData.numero_causa);
  await page.selectOption('[data-testid="materia-select"]', caseData.materia);
  await page.fill('[data-testid="tribunal-input"]', caseData.tribunal);
  await page.fill('[data-testid="nombre-cliente-input"]', caseData.nombre_cliente);
  await page.fill('[data-testid="rut-cliente-input"]', caseData.rut_cliente);
  
  // Set fecha_inicio to today
  const today = new Date().toISOString().split('T')[0];
  await page.fill('[data-testid="fecha-inicio-input"]', today);
  
  await page.click('[data-testid="create-case-button"]');
  await page.waitForURL('/cases/*');
}

test.describe('Case Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test data if needed
    await page.goto('/');
  });

  test.describe('Authentication and Authorization', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
      await page.goto('/cases');
      await page.waitForURL('/login');
      expect(page.url()).toContain('/login');
    });

    test('should allow lawyer to access cases page', async ({ page }) => {
      await loginAsLawyer(page);
      await page.goto('/cases');
      await expect(page.locator('[data-testid="cases-page"]')).toBeVisible();
    });

    test('should allow admin to access all features', async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto('/admin/security');
      await expect(page.locator('[data-testid="security-dashboard"]')).toBeVisible();
    });

    test('should prevent client from accessing admin features', async ({ page }) => {
      // This would need a client login function
      await page.goto('/login');
      await page.fill('[data-testid="email-input"]', 'cliente@xelchile.com');
      await page.fill('[data-testid="password-input"]', 'client123');
      await page.click('[data-testid="login-button"]');
      
      await page.goto('/admin/security');
      await page.waitForURL('/client-portal');
    });
  });

  test.describe('Case Creation and Management', () => {
    test('should create a new case successfully', async ({ page }) => {
      await loginAsLawyer(page);
      
      const caseData = {
        caratulado: 'Test Case vs Defendant',
        numero_causa: 'C-2024-E2E-001',
        materia: 'Civil',
        tribunal: 'Juzgado Civil de Santiago',
        nombre_cliente: 'Juan Pérez Test',
        rut_cliente: '12345678-5',
      };

      await createTestCase(page, caseData);
      
      // Verify case was created
      await expect(page.locator('[data-testid="case-title"]')).toContainText(caseData.caratulado);
      await expect(page.locator('[data-testid="case-number"]')).toContainText(caseData.numero_causa);
      await expect(page.locator('[data-testid="case-client"]')).toContainText(caseData.nombre_cliente);
    });

    test('should validate required fields in case creation', async ({ page }) => {
      await loginAsLawyer(page);
      await page.goto('/cases/new');
      
      // Try to submit without required fields
      await page.click('[data-testid="create-case-button"]');
      
      // Check for validation errors
      await expect(page.locator('[data-testid="caratulado-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="tribunal-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="nombre-cliente-error"]')).toBeVisible();
    });

    test('should validate RUT format', async ({ page }) => {
      await loginAsLawyer(page);
      await page.goto('/cases/new');
      
      await page.fill('[data-testid="rut-cliente-input"]', 'invalid-rut');
      await page.blur('[data-testid="rut-cliente-input"]');
      
      await expect(page.locator('[data-testid="rut-cliente-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="rut-cliente-error"]')).toContainText('RUT');
    });

    test('should update case information', async ({ page }) => {
      await loginAsLawyer(page);
      
      // First create a case
      const caseData = {
        caratulado: 'Original Case Name',
        numero_causa: 'C-2024-UPDATE-001',
        materia: 'Civil',
        tribunal: 'Test Court',
        nombre_cliente: 'Test Client',
        rut_cliente: '12345678-5',
      };

      await createTestCase(page, caseData);
      
      // Edit the case
      await page.click('[data-testid="edit-case-button"]');
      await page.fill('[data-testid="caratulado-input"]', 'Updated Case Name');
      await page.selectOption('[data-testid="estado-select"]', 'suspendido');
      await page.fill('[data-testid="observaciones-textarea"]', 'Updated observations');
      await page.click('[data-testid="save-case-button"]');
      
      // Verify updates
      await expect(page.locator('[data-testid="case-title"]')).toContainText('Updated Case Name');
      await expect(page.locator('[data-testid="case-status"]')).toContainText('Suspendido');
      await expect(page.locator('[data-testid="case-observations"]')).toContainText('Updated observations');
    });

    test('should filter and search cases', async ({ page }) => {
      await loginAsLawyer(page);
      await page.goto('/cases');
      
      // Test search functionality
      await page.fill('[data-testid="search-input"]', 'Test Case');
      await page.press('[data-testid="search-input"]', 'Enter');
      
      // Wait for search results
      await page.waitForTimeout(1000);
      
      // Verify search results
      const caseRows = page.locator('[data-testid="case-row"]');
      await expect(caseRows.first()).toBeVisible();
      
      // Test filter by status
      await page.selectOption('[data-testid="estado-filter"]', 'activo');
      await page.waitForTimeout(1000);
      
      // Test filter by materia
      await page.selectOption('[data-testid="materia-filter"]', 'Civil');
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Case Timeline and Stages', () => {
    test('should add stages to case timeline', async ({ page }) => {
      await loginAsLawyer(page);
      
      // Create a case first
      const caseData = {
        caratulado: 'Timeline Test Case',
        numero_causa: 'C-2024-TIMELINE-001',
        materia: 'Civil',
        tribunal: 'Test Court',
        nombre_cliente: 'Timeline Client',
        rut_cliente: '12345678-5',
      };

      await createTestCase(page, caseData);
      
      // Navigate to timeline tab
      await page.click('[data-testid="timeline-tab"]');
      
      // Add a new stage
      await page.click('[data-testid="add-stage-button"]');
      await page.fill('[data-testid="stage-name-input"]', 'Demanda');
      await page.fill('[data-testid="stage-description-textarea"]', 'Presentación de demanda');
      
      // Set future date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateString = futureDate.toISOString().split('T')[0];
      await page.fill('[data-testid="stage-date-input"]', futureDateString);
      
      await page.click('[data-testid="save-stage-button"]');
      
      // Verify stage was added
      await expect(page.locator('[data-testid="stage-item"]')).toBeVisible();
      await expect(page.locator('[data-testid="stage-name"]')).toContainText('Demanda');
    });

    test('should complete a stage', async ({ page }) => {
      await loginAsLawyer(page);
      
      // Assuming we have a case with stages
      await page.goto('/cases'); // Navigate to cases list
      await page.click('[data-testid="case-row"]'); // Click first case
      await page.click('[data-testid="timeline-tab"]');
      
      // Complete a pending stage
      await page.click('[data-testid="complete-stage-button"]');
      await page.fill('[data-testid="completion-notes-textarea"]', 'Stage completed successfully');
      await page.click('[data-testid="confirm-completion-button"]');
      
      // Verify stage is marked as completed
      await expect(page.locator('[data-testid="stage-status"]')).toContainText('Completada');
    });
  });

  test.describe('Document Management', () => {
    test('should upload a document to case', async ({ page }) => {
      await loginAsLawyer(page);
      
      // Navigate to a case
      await page.goto('/cases');
      await page.click('[data-testid="case-row"]');
      await page.click('[data-testid="documents-tab"]');
      
      // Upload document
      await page.click('[data-testid="upload-document-button"]');
      
      // Fill document details
      await page.fill('[data-testid="document-name-input"]', 'Test Document.pdf');
      await page.fill('[data-testid="document-description-textarea"]', 'Test document description');
      await page.selectOption('[data-testid="document-type-select"]', 'contrato');
      await page.check('[data-testid="visible-cliente-checkbox"]');
      
      // Simulate file upload (in real test, you'd use setInputFiles)
      // await page.setInputFiles('[data-testid="file-input"]', 'path/to/test/file.pdf');
      
      await page.click('[data-testid="save-document-button"]');
      
      // Verify document was uploaded
      await expect(page.locator('[data-testid="document-item"]')).toBeVisible();
      await expect(page.locator('[data-testid="document-name"]')).toContainText('Test Document.pdf');
    });

    test('should download a document', async ({ page }) => {
      await loginAsLawyer(page);
      
      // Navigate to case documents
      await page.goto('/cases');
      await page.click('[data-testid="case-row"]');
      await page.click('[data-testid="documents-tab"]');
      
      // Start download
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-document-button"]');
      const download = await downloadPromise;
      
      // Verify download started
      expect(download.suggestedFilename()).toBeTruthy();
    });
  });

  test.describe('Notes Management', () => {
    test('should add a note to case', async ({ page }) => {
      await loginAsLawyer(page);
      
      // Navigate to case notes
      await page.goto('/cases');
      await page.click('[data-testid="case-row"]');
      await page.click('[data-testid="notes-tab"]');
      
      // Add new note
      await page.click('[data-testid="add-note-button"]');
      await page.fill('[data-testid="note-title-input"]', 'Important Note');
      await page.fill('[data-testid="note-content-textarea"]', 'This is an important note about the case');
      await page.selectOption('[data-testid="note-category-select"]', 'general');
      await page.check('[data-testid="note-private-checkbox"]');
      await page.click('[data-testid="save-note-button"]');
      
      // Verify note was added
      await expect(page.locator('[data-testid="note-item"]')).toBeVisible();
      await expect(page.locator('[data-testid="note-title"]')).toContainText('Important Note');
    });

    test('should edit an existing note', async ({ page }) => {
      await loginAsLawyer(page);
      
      // Navigate to case notes
      await page.goto('/cases');
      await page.click('[data-testid="case-row"]');
      await page.click('[data-testid="notes-tab"]');
      
      // Edit existing note
      await page.click('[data-testid="edit-note-button"]');
      await page.fill('[data-testid="note-title-input"]', 'Updated Note Title');
      await page.fill('[data-testid="note-content-textarea"]', 'Updated note content');
      await page.click('[data-testid="save-note-button"]');
      
      // Verify note was updated
      await expect(page.locator('[data-testid="note-title"]')).toContainText('Updated Note Title');
    });
  });

  test.describe('Information Requests', () => {
    test('should create an information request', async ({ page }) => {
      await loginAsLawyer(page);
      
      // Navigate to case requests
      await page.goto('/cases');
      await page.click('[data-testid="case-row"]');
      await page.click('[data-testid="requests-tab"]');
      
      // Create new request
      await page.click('[data-testid="create-request-button"]');
      await page.fill('[data-testid="request-title-input"]', 'Document Request');
      await page.fill('[data-testid="request-description-textarea"]', 'Please provide the signed contract');
      await page.selectOption('[data-testid="request-type-select"]', 'documento');
      await page.selectOption('[data-testid="request-priority-select"]', 'alta');
      
      // Set deadline
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateString = futureDate.toISOString().split('T')[0];
      await page.fill('[data-testid="request-deadline-input"]', futureDateString);
      
      await page.click('[data-testid="save-request-button"]');
      
      // Verify request was created
      await expect(page.locator('[data-testid="request-item"]')).toBeVisible();
      await expect(page.locator('[data-testid="request-title"]')).toContainText('Document Request');
    });

    test('should respond to an information request', async ({ page }) => {
      await loginAsLawyer(page);
      
      // Navigate to case requests
      await page.goto('/cases');
      await page.click('[data-testid="case-row"]');
      await page.click('[data-testid="requests-tab"]');
      
      // Respond to request
      await page.click('[data-testid="respond-request-button"]');
      await page.fill('[data-testid="response-textarea"]', 'The document has been uploaded to the documents section');
      await page.click('[data-testid="save-response-button"]');
      
      // Verify response was saved
      await expect(page.locator('[data-testid="request-status"]')).toContainText('Respondida');
      await expect(page.locator('[data-testid="request-response"]')).toContainText('The document has been uploaded');
    });
  });

  test.describe('Client Portal Access', () => {
    test('should generate magic link for client', async ({ page }) => {
      await loginAsLawyer(page);
      
      // Navigate to case clients
      await page.goto('/cases');
      await page.click('[data-testid="case-row"]');
      await page.click('[data-testid="clients-tab"]');
      
      // Generate magic link
      await page.click('[data-testid="generate-magic-link-button"]');
      await page.fill('[data-testid="client-email-input"]', 'cliente@test.com');
      await page.selectOption('[data-testid="link-duration-select"]', '24');
      await page.check('[data-testid="permission-view-case"]');
      await page.check('[data-testid="permission-view-documents"]');
      await page.click('[data-testid="generate-link-button"]');
      
      // Verify link was generated
      await expect(page.locator('[data-testid="generated-link"]')).toBeVisible();
      await expect(page.locator('[data-testid="magic-link-item"]')).toBeVisible();
    });

    test('should access case via magic link', async ({ page }) => {
      // This test would require a pre-generated magic link
      const magicLinkToken = 'test-magic-link-token';
      
      await page.goto(`/client-access?token=${magicLinkToken}`);
      
      // Should redirect to client portal
      await page.waitForURL('/client-portal');
      
      // Verify client can see case information
      await expect(page.locator('[data-testid="client-case-info"]')).toBeVisible();
      await expect(page.locator('[data-testid="client-documents"]')).toBeVisible();
    });
  });

  test.describe('Dashboard and Analytics', () => {
    test('should display dashboard with statistics', async ({ page }) => {
      await loginAsLawyer(page);
      await page.goto('/dashboard');
      
      // Verify dashboard elements
      await expect(page.locator('[data-testid="total-cases-stat"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-cases-stat"]')).toBeVisible();
      await expect(page.locator('[data-testid="clients-stat"]')).toBeVisible();
      await expect(page.locator('[data-testid="documents-stat"]')).toBeVisible();
      
      // Verify charts are present
      await expect(page.locator('[data-testid="cases-by-status-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="cases-by-materia-chart"]')).toBeVisible();
    });

    test('should filter dashboard by time period', async ({ page }) => {
      await loginAsLawyer(page);
      await page.goto('/dashboard');
      
      // Change time period
      await page.click('[data-testid="period-3m-button"]');
      await page.waitForTimeout(1000);
      
      await page.click('[data-testid="period-6m-button"]');
      await page.waitForTimeout(1000);
      
      await page.click('[data-testid="period-12m-button"]');
      await page.waitForTimeout(1000);
      
      // Verify charts update (this would need more specific assertions)
      await expect(page.locator('[data-testid="monthly-stats-chart"]')).toBeVisible();
    });
  });

  test.describe('Security and Audit', () => {
    test('should log user actions for audit', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Perform some actions that should be audited
      await page.goto('/cases/new');
      await page.fill('[data-testid="caratulado-input"]', 'Audit Test Case');
      await page.fill('[data-testid="numero-causa-input"]', 'C-2024-AUDIT-001');
      await page.selectOption('[data-testid="materia-select"]', 'Civil');
      await page.fill('[data-testid="tribunal-input"]', 'Test Court');
      await page.fill('[data-testid="nombre-cliente-input"]', 'Audit Client');
      await page.fill('[data-testid="rut-cliente-input"]', '12345678-5');
      
      const today = new Date().toISOString().split('T')[0];
      await page.fill('[data-testid="fecha-inicio-input"]', today);
      
      await page.click('[data-testid="create-case-button"]');
      await page.waitForURL('/cases/*');
      
      // Check audit logs
      await page.goto('/admin/security');
      await page.click('[data-testid="audit-tab"]');
      
      // Verify audit entry exists
      await expect(page.locator('[data-testid="audit-log-item"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-action"]').first()).toContainText('INSERT');
      await expect(page.locator('[data-testid="audit-table"]').first()).toContainText('cases');
    });

    test('should detect and block suspicious activity', async ({ page }) => {
      // This test would simulate suspicious activity patterns
      // For example, multiple failed login attempts
      
      await page.goto('/login');
      
      // Simulate multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await page.fill('[data-testid="email-input"]', 'test@example.com');
        await page.fill('[data-testid="password-input"]', 'wrongpassword');
        await page.click('[data-testid="login-button"]');
        await page.waitForTimeout(1000);
      }
      
      // Should show rate limit message
      await expect(page.locator('[data-testid="rate-limit-message"]')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      await loginAsLawyer(page);
      await page.goto('/cases');
      
      // Verify mobile navigation
      await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      await page.click('[data-testid="mobile-menu-button"]');
      await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
      
      // Test case creation on mobile
      await page.click('[data-testid="new-case-mobile-button"]');
      await expect(page.locator('[data-testid="case-form"]')).toBeVisible();
    });

    test('should work on tablet devices', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      
      await loginAsLawyer(page);
      await page.goto('/dashboard');
      
      // Verify tablet layout
      await expect(page.locator('[data-testid="dashboard-grid"]')).toBeVisible();
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load pages within acceptable time', async ({ page }) => {
      await loginAsLawyer(page);
      
      // Measure page load times
      const startTime = Date.now();
      await page.goto('/cases');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      await loginAsLawyer(page);
      await page.goto('/cases');
      
      // Test pagination with large dataset
      await page.selectOption('[data-testid="page-size-select"]', '100');
      await page.waitForTimeout(2000);
      
      // Should still be responsive
      await expect(page.locator('[data-testid="cases-table"]')).toBeVisible();
      
      // Test search performance
      const searchStartTime = Date.now();
      await page.fill('[data-testid="search-input"]', 'test');
      await page.waitForTimeout(1000);
      const searchTime = Date.now() - searchStartTime;
      
      expect(searchTime).toBeLessThan(2000);
    });
  });
});
