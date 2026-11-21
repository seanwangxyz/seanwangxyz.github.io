(() => {
  const panel = document.querySelector('#company-lookup');
  const data = window.PSW_COMPANY_LOOKUP;
  if (!panel || !Array.isArray(data) || !data.length) return;

  const field = panel.querySelector('#lookup-query');
  const form = panel.querySelector('#lookup-form');
  const menu = panel.querySelector('#lookup-matches');
  const status = panel.querySelector('#lookup-status');
  const clean = text => String(text || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
  const companies = data.map(([name, ticker, year, millions, share]) => ({
    name, ticker, year, millions, share, byName: clean(name), byTicker: clean(ticker)
  }));
  let matches = [];
  let active = -1;
  let selected = companies.find(company => company.ticker === 'AMZN') || companies[0];

  function formatAmount(millions) {
    const billions = millions >= 1000;
    const value = billions ? millions / 1000 : millions;
    return '$' + value.toLocaleString('en-US', {
      minimumFractionDigits: billions ? 1 : 0, maximumFractionDigits: billions ? 1 : 0
    }) + (billions ? 'B' : 'M');
  }

  function search(value) {
    const query = clean(value);
    if (!query) return [];
    function rank(company) {
      if (company.byTicker === query || company.byName === query) return 0;
      if (company.byName.startsWith(query)) return 1;
      if (company.byTicker.startsWith(query)) return 2;
      return company.byName.includes(query) || company.byTicker.includes(query) ? 3 : 4;
    }
    return companies.map(company => ({company, rank: rank(company)}))
      .filter(item => item.rank < 4)
      .sort((a, b) => a.rank - b.rank || b.company.millions - a.company.millions)
      .slice(0, 6).map(item => item.company);
  }

  function closeMenu() {
    menu.hidden = true;
    field.setAttribute('aria-expanded', 'false');
    field.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function highlight(index) {
    active = index;
    Array.from(menu.children).forEach((option, i) => {
      option.setAttribute('aria-selected', String(i === active));
    });
    field.setAttribute('aria-activedescendant', 'lookup-option-' + active);
  }

  function suggest() {
    matches = search(field.value);
    menu.replaceChildren();
    active = -1;
    field.removeAttribute('aria-activedescendant');
    if (!matches.length) {
      closeMenu();
      status.textContent = field.value.trim() ? 'No match among the 2,000 firms. Showing ' + selected.name + '.' : '';
      return;
    }
    matches.forEach((company, index) => {
      const option = document.createElement('li');
      option.id = 'lookup-option-' + index;
      option.dataset.index = String(index);
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const name = document.createElement('span');
      name.textContent = company.name;
      const ticker = document.createElement('b');
      ticker.textContent = company.ticker;
      option.append(name, ticker);
      menu.append(option);
    });
    menu.hidden = false;
    field.setAttribute('aria-expanded', 'true');
    status.textContent = '';
  }

  function render(company, updateUrl = false) {
    selected = company;
    const amount = formatAmount(company.millions);
    const hasShare = Number.isFinite(company.share) && company.share >= 0;
    panel.querySelector('#lookup-ticker').textContent = company.ticker || 'Company estimate';
    panel.querySelector('#lookup-period').textContent = 'FY ' + company.year;
    panel.querySelector('#lookup-name').textContent = company.name;
    panel.querySelector('#lookup-amount').textContent = amount;
    panel.querySelector('#lookup-percent').textContent = hasShare ? company.share + '%' : 'Unavailable';
    panel.querySelector('.lk-meter').hidden = !hasShare;
    panel.querySelector('#lookup-fill').style.width = hasShare ? company.share + '%' : '0';
    field.value = company.ticker || company.name;
    closeMenu();
    if (!updateUrl) return;
    status.textContent = company.name + ', FY ' + company.year + '. Estimated off-book capital ' + amount + '.';
    const url = new URL(window.location.href);
    const uniqueTicker = company.ticker && companies.filter(firm => firm.ticker === company.ticker).length === 1;
    url.searchParams.set('company', uniqueTicker ? company.ticker : company.name);
    url.hash = 'company-lookup';
    if (url.protocol === 'https:' || url.protocol === 'http:') window.history.replaceState(window.history.state, '', url);
  }

  field.addEventListener('input', suggest);
  field.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeMenu(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (menu.hidden) suggest();
    if (menu.hidden) return;
    event.preventDefault();
    if (event.key === 'ArrowDown') highlight((active + 1) % matches.length);
    else highlight(active <= 0 ? matches.length - 1 : active - 1);
  });
  field.addEventListener('blur', closeMenu);
  menu.addEventListener('mousedown', event => event.preventDefault());
  menu.addEventListener('click', event => {
    const option = event.target.closest('[data-index]');
    if (option) render(matches[Number(option.dataset.index)], true);
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const result = !menu.hidden && active !== -1 ? matches[active] : search(field.value)[0];
    if (result) { render(result, true); return; }
    status.textContent = field.value.trim() ? 'No match among the 2,000 firms. Showing ' + selected.name + '.' : 'Enter a company name or ticker.';
    field.focus();
  });
  panel.querySelectorAll('[data-ticker]').forEach(button => {
    button.addEventListener('click', () => {
      const company = companies.find(firm => firm.ticker === button.dataset.ticker);
      if (company) render(company, true);
    });
  });
  const requested = clean(new URL(window.location.href).searchParams.get('company'));
  const linked = requested && companies.find(company => company.byTicker === requested || company.byName === requested);
  render(linked || selected);
  if (!linked) field.value = '';
  if (requested && !linked) status.textContent = 'Company unavailable. Showing ' + selected.name + '.';
  panel.querySelector('.lk-controls').hidden = false;
})();

(() => {
  function initializeExhibit(exhibit) {
    const ink = exhibit.querySelector('#sw-sign-ink');
    const frame = exhibit.querySelector('#sw-sign-box');
    const measurement = exhibit.querySelector('.sw-lab__measure');

    // Round caps and joins extend each path by half its own ink width.
    function drawFrame() {
      if (!measurement.open) {
        frame.setAttribute('visibility', 'hidden');
        return;
      }
      const bounds = Array.from(ink.querySelectorAll('path'), path => {
        const box = path.getBBox();
        const radius = parseFloat(getComputedStyle(path).strokeWidth) / 2;
        return [box.x - radius, box.y - radius, box.x + box.width + radius, box.y + box.height + radius];
      });
      const left = Math.min(...bounds.map(box => box[0]));
      const top = Math.min(...bounds.map(box => box[1]));
      const right = Math.max(...bounds.map(box => box[2]));
      const bottom = Math.max(...bounds.map(box => box[3]));
      frame.setAttribute('x', left);
      frame.setAttribute('y', top);
      frame.setAttribute('width', right - left);
      frame.setAttribute('height', bottom - top);
      frame.setAttribute('visibility', 'visible');
    }

    measurement.addEventListener('toggle', drawFrame);
    drawFrame();

    const answers = {
      loss: 'Correct. The store earned $80,000, but investors required $100,000 on their $1 million. Economic profit was $80,000 − $100,000 = −$20,000.',
      breakeven: 'Break-even would require $100,000 of operating profit. The store earned $80,000, leaving a $20,000 shortfall. Its economic profit was −$20,000.',
      operating: 'That is the store’s operating profit. The capital tied up in the store also costs $100,000 per year. Deduct it and economic profit is −$20,000.'
    };
    const options = exhibit.querySelector('.sw-lab__options');
    const result = exhibit.querySelector('.sw-lab__result');
    function explain(selection) {
      result.textContent = answers[selection.value];
    }
    options.addEventListener('change', event => {
      if (event.target.matches('input[type="radio"]')) explain(event.target);
    });
    const restoredAnswer = options.querySelector('input:checked');
    if (restoredAnswer) explain(restoredAnswer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeExhibit(document));
  } else {
    initializeExhibit(document);
  }
})();

