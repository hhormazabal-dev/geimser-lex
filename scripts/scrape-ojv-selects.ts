import { chromium } from '@playwright/test';

type OptionDump = {
  value: string;
  text: string;
  disabled: boolean;
  selected: boolean;
};

type SelectDump = {
  id: string | null;
  name: string | null;
  label: string | null;
  options: OptionDump[];
  valueTypeHint: 'numeric-string' | 'string' | 'mixed';
};

function classifyValueType(values: string[]): SelectDump['valueTypeHint'] {
  const nonEmpty = values.filter((v) => v.trim().length > 0);
  if (nonEmpty.length === 0) return 'string';
  const numeric = nonEmpty.filter((v) => /^\d+$/.test(v)).length;
  if (numeric === nonEmpty.length) return 'numeric-string';
  if (numeric === 0) return 'string';
  return 'mixed';
}

async function main() {
  const argv = process.argv.slice(2);
  const url =
    argv.find((a) => a.startsWith('http://') || a.startsWith('https://')) ??
    'https://oficinajudicialvirtual.pjud.cl/indexN.php';
  const headful = argv.includes('--headful');
  const timeoutMs = Number(process.env.OJV_TIMEOUT_MS ?? 60_000);

  const browser = await chromium.launch({ headless: !headful });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1000);

    const selects = await page.evaluate(() => {
      const getLabelText = (select: HTMLSelectElement): string | null => {
        const id = select.getAttribute('id');
        if (id) {
          const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
          if (label?.textContent) return label.textContent.trim();
        }

        const wrappingLabel = select.closest('label');
        if (wrappingLabel?.textContent) return wrappingLabel.textContent.trim();

        const ariaLabel = select.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel.trim();

        return null;
      };

      return Array.from(document.querySelectorAll('select')).map((select) => {
        const options = Array.from(select.options).map((opt) => ({
          value: opt.value ?? '',
          text: (opt.textContent ?? '').trim(),
          disabled: Boolean(opt.disabled),
          selected: Boolean(opt.selected),
        }));
        return {
          id: select.getAttribute('id'),
          name: select.getAttribute('name'),
          label: getLabelText(select),
          options,
        };
      });
    });

    const dumped: SelectDump[] = selects.map((s) => {
      const values = s.options.map((o) => o.value);
      return {
        ...s,
        valueTypeHint: classifyValueType(values),
      };
    });

    process.stdout.write(`${JSON.stringify({ url, scrapedAt: new Date().toISOString(), selects: dumped }, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

