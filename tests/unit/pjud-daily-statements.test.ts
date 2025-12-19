import { describe, expect, test } from 'vitest';
import { parsePjudDailyStatementsHtml } from '@/lib/pjud/daily-statements-parser';

describe('parsePjudDailyStatementsHtml', () => {
  test('parses competencia tables and civil linkMeta', () => {
    const html = `
      <div class="card">
        <div class="card-header bg-pjud">Estados diario competencia civil del día 18-12-2025</div>
        <div class="card-body">
          <table id="data-table-estado-diario-civil">
            <tbody>
              <tr>
                <td>1</td>
                <td>
                  <a href="javascript:void(0);" data-tipocausa="C" data-rol="155" data-era="2025" data-date="18-12-2025" data-codoracle="1152">C-155-2025</a>
                </td>
                <td align="left">  Herrera/Herrera  </td>
                <td> 1 </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header bg-pjud">Estados diario competencia penal del día 18-12-2025</div>
        <div class="card-body">
          <table id="data-table-estado-diario-penal">
            <tbody>
              <tr>
                <td>1</td>
                <td>P-1-2025</td>
                <td>Fiscalía/Imputado</td>
                <td>3</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const parsed = parsePjudDailyStatementsHtml(html);
    expect(parsed.date).toBe('18-12-2025');
    expect(parsed.items).toHaveLength(2);

    const civil = parsed.items[0]!;
    expect(civil.competencia).toBe('civil');
    expect(civil.numeroIngreso).toBe('C-155-2025');
    expect(civil.partes).toBe('Herrera/Herrera');
    expect(civil.providencias).toBe('1');
    expect(civil.linkMeta?.tipocausa).toBe('C');
    expect(civil.linkMeta?.rol).toBe('155');
    expect(civil.linkMeta?.era).toBe('2025');
    expect(civil.linkMeta?.date).toBe('18-12-2025');
    expect(civil.linkMeta?.codoracle).toBe('1152');

    const penal = parsed.items[1]!;
    expect(penal.competencia).toBe('penal');
    expect(penal.linkMeta).toBeUndefined();
  });

  test('parses single-competencia panel table', () => {
    const html = `
      <div class="panel panel-primary border">
        <div class="panel-heading">Estados diario competencia laboral del día 18-12-2025</div>
        <div class="panel-body">
          <table id="data-table-estado-diario" class="table">
            <tbody>
              <tr>
                <td>1</td>
                <td>O-6481-2025</td>
                <td> Díaz/Copec S.a </td>
                <td> 2 </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const parsed = parsePjudDailyStatementsHtml(html);
    expect(parsed.date).toBe('18-12-2025');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]).toMatchObject({
      competencia: 'laboral',
      numeroIngreso: 'O-6481-2025',
      partes: 'Díaz/Copec S.a',
      providencias: '2',
    });
  });
});
