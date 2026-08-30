document.addEventListener('DOMContentLoaded', () => {
  /* ── DOM ── */
  const catTabs = document.querySelectorAll('.btn-cat');
  const fromValue = document.getElementById('fromValue');
  const toValue = document.getElementById('toValue');
  const fromUnit = document.getElementById('fromUnit');
  const toUnit = document.getElementById('toUnit');
  const swapBtn = document.getElementById('swapBtn');
  const formulaText = document.getElementById('formulaText');
  const refGrid = document.getElementById('refGrid');
  const toast = document.getElementById('toast');

  /* ── Unit data: each unit has a factor relative to the base unit ── */
  /* Length base: meter */
  /* Weight base: kilogram */
  /* Volume base: liter */
  /* Speed base: m/s */
  /* Data base: byte */
  const CATEGORIES = {
    length: {
      label: 'Length',
      units: {
        meter:      { label: 'Meter (m)',      factor: 1 },
        kilometer:  { label: 'Kilometer (km)',  factor: 1000 },
        centimeter: { label: 'Centimeter (cm)', factor: 0.01 },
        millimeter: { label: 'Millimeter (mm)', factor: 0.001 },
        mile:       { label: 'Mile (mi)',       factor: 1609.344 },
        yard:       { label: 'Yard (yd)',       factor: 0.9144 },
        foot:       { label: 'Foot (ft)',       factor: 0.3048 },
        inch:       { label: 'Inch (in)',       factor: 0.0254 },
        nauticalMile: { label: 'Nautical Mile', factor: 1852 },
      },
      defaultFrom: 'kilometer',
      defaultTo: 'mile',
    },
    weight: {
      label: 'Weight',
      units: {
        kilogram:  { label: 'Kilogram (kg)',  factor: 1 },
        gram:      { label: 'Gram (g)',       factor: 0.001 },
        milligram: { label: 'Milligram (mg)', factor: 0.000001 },
        pound:     { label: 'Pound (lb)',     factor: 0.453592 },
        ounce:     { label: 'Ounce (oz)',     factor: 0.0283495 },
        ton:       { label: 'Metric Ton (t)', factor: 1000 },
        stone:     { label: 'Stone (st)',     factor: 6.35029 },
      },
      defaultFrom: 'kilogram',
      defaultTo: 'pound',
    },
    temperature: {
      label: 'Temperature',
      units: {
        celsius:    { label: 'Celsius (°C)' },
        fahrenheit: { label: 'Fahrenheit (°F)' },
        kelvin:     { label: 'Kelvin (K)' },
      },
      defaultFrom: 'celsius',
      defaultTo: 'fahrenheit',
    },
    volume: {
      label: 'Volume',
      units: {
        liter:      { label: 'Liter (L)',       factor: 1 },
        milliliter: { label: 'Milliliter (mL)', factor: 0.001 },
        gallon:     { label: 'US Gallon (gal)', factor: 3.78541 },
        quart:      { label: 'US Quart (qt)',   factor: 0.946353 },
        cup:        { label: 'US Cup',          factor: 0.236588 },
        fluidOz:    { label: 'US Fl Oz',        factor: 0.0295735 },
        tablespoon: { label: 'Tablespoon (tbsp)', factor: 0.0147868 },
        teaspoon:   { label: 'Teaspoon (tsp)',  factor: 0.00492892 },
        cubicMeter: { label: 'Cubic Meter (m³)', factor: 1000 },
      },
      defaultFrom: 'liter',
      defaultTo: 'gallon',
    },
    speed: {
      label: 'Speed',
      units: {
        ms:   { label: 'Meters/sec (m/s)',    factor: 1 },
        kmh:  { label: 'Kilometers/hr (km/h)', factor: 0.277778 },
        mph:  { label: 'Miles/hr (mph)',      factor: 0.44704 },
        knot: { label: 'Knots (kn)',          factor: 0.514444 },
        mach: { label: 'Mach',               factor: 343 },
        fts:  { label: 'Feet/sec (ft/s)',     factor: 0.3048 },
      },
      defaultFrom: 'kmh',
      defaultTo: 'mph',
    },
    data: {
      label: 'Data Storage',
      units: {
        byte:  { label: 'Byte (B)',        factor: 1 },
        kb:    { label: 'Kilobyte (KB)',   factor: 1024 },
        mb:    { label: 'Megabyte (MB)',    factor: 1048576 },
        gb:    { label: 'Gigabyte (GB)',    factor: 1073741824 },
        tb:    { label: 'Terabyte (TB)',    factor: 1099511627776 },
        pb:    { label: 'Petabyte (PB)',    factor: 1125899906842624 },
        bit:   { label: 'Bit',             factor: 0.125 },
        kib:   { label: 'Kibibyte (KiB)',  factor: 1024 },
        mib:   { label: 'Mebibyte (MiB)',  factor: 1048576 },
        gib:   { label: 'Gibibyte (GiB)',  factor: 1073741824 },
      },
      defaultFrom: 'gb',
      defaultTo: 'mb',
    },
  };

  /* ── State ── */
  let currentCat = 'length';

  /* ── Temperature special conversion ── */
  function convertTemperature(value, from, to) {
    // Convert to Celsius first
    let celsius;
    switch (from) {
      case 'celsius':    celsius = value; break;
      case 'fahrenheit': celsius = (value - 32) * 5 / 9; break;
      case 'kelvin':     celsius = value - 273.15; break;
    }
    // Convert from Celsius to target
    switch (to) {
      case 'celsius':    return celsius;
      case 'fahrenheit': return celsius * 9 / 5 + 32;
      case 'kelvin':     return celsius + 273.15;
    }
  }

  function getTemperatureFormula(from, to) {
    const formulas = {
      'celsius-fahrenheit':    '°F = °C × 9/5 + 32',
      'fahrenheit-celsius':    '°C = (°F − 32) × 5/9',
      'celsius-kelvin':        'K = °C + 273.15',
      'kelvin-celsius':        '°C = K − 273.15',
      'fahrenheit-kelvin':     'K = (°F − 32) × 5/9 + 273.15',
      'kelvin-fahrenheit':     '°F = (K − 273.15) × 9/5 + 32',
      'celsius-celsius':       '°C = °C',
      'fahrenheit-fahrenheit': '°F = °F',
      'kelvin-kelvin':         'K = K',
    };
    return formulas[`${from}-${to}`] || '';
  }

  /* ── Populate unit dropdowns ── */
  function populateUnits() {
    const cat = CATEGORIES[currentCat];
    const units = cat.units;
    fromUnit.innerHTML = '';
    toUnit.innerHTML = '';

    Object.entries(units).forEach(([key, u]) => {
      fromUnit.add(new Option(u.label, key));
      toUnit.add(new Option(u.label, key));
    });

    fromUnit.value = cat.defaultFrom;
    toUnit.value = cat.defaultTo;
  }

  /* ── Convert ── */
  function convert() {
    const val = parseFloat(fromValue.value);
    if (isNaN(val) || fromValue.value.trim() === '') {
      toValue.value = '';
      formulaText.textContent = '';
      return;
    }

    const from = fromUnit.value;
    const to = toUnit.value;
    let result;

    if (currentCat === 'temperature') {
      result = convertTemperature(val, from, to);
    } else {
      const cat = CATEGORIES[currentCat];
      const baseVal = val * cat.units[from].factor;
      result = baseVal / cat.units[to].factor;
    }

    // Smart formatting
    if (Math.abs(result) >= 1e10 || (Math.abs(result) < 0.0001 && result !== 0)) {
      toValue.value = result.toExponential(4);
    } else {
      // Remove trailing zeros but keep up to 8 decimal places
      const formatted = parseFloat(result.toFixed(8));
      toValue.value = formatted;
    }

    // Formula
    if (currentCat === 'temperature') {
      formulaText.textContent = getTemperatureFormula(from, to);
    } else {
      const cat = CATEGORIES[currentCat];
      const factor = cat.units[from].factor / cat.units[to].factor;
      formulaText.textContent = `1 ${from} = ${parseFloat(factor.toPrecision(6))} ${to}`;
    }
  }

  /* ── Quick Reference ── */
  function renderReference() {
    const cat = CATEGORIES[currentCat];
    const keys = Object.keys(cat.units);
    const items = [];

    if (currentCat === 'temperature') {
      const presets = [
        { from: 'celsius', to: 'fahrenheit', vals: [0, 20, 37, 100] },
      ];
      presets.forEach((p) => {
        p.vals.forEach((v) => {
          const result = convertTemperature(v, p.from, p.to);
          items.push({
            from: `${v} ${cat.units[p.from].label.split('(')[0].trim()}`,
            to: `${parseFloat(result.toFixed(2))} ${cat.units[p.to].label.split('(')[0].trim()}`,
          });
        });
      });
    } else {
      // Pick a few common pairs
      const fromKey = cat.defaultFrom;
      const toKey = cat.defaultTo;
      const factor = cat.units[fromKey].factor / cat.units[toKey].factor;
      [1, 5, 10, 50, 100].forEach((v) => {
        const result = v * factor;
        const fromLabel = cat.units[fromKey].label.split('(')[0].trim();
        const toLabel = cat.units[toKey].label.split('(')[0].trim();
        items.push({
          from: `${v} ${fromLabel}`,
          to: `${parseFloat(result.toPrecision(6))} ${toLabel}`,
        });
      });
    }

    refGrid.innerHTML = items
      .map(
        (item) => `
        <div class="ref-item">
          <span class="ref-from">${item.from}</span>
          <span class="ref-eq">=</span>
          <span class="ref-to">${item.to}</span>
        </div>`
      )
      .join('');
  }

  /* ── Toast ── */
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 1800);
  }

  /* ── Events ── */
  catTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      catTabs.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentCat = btn.dataset.cat;
      populateUnits();
      convert();
      renderReference();
    });
  });

  fromValue.addEventListener('input', convert);
  fromUnit.addEventListener('change', () => { convert(); renderReference(); });
  toUnit.addEventListener('change', () => { convert(); renderReference(); });

  swapBtn.addEventListener('click', () => {
    const tmpUnit = fromUnit.value;
    const tmpVal = toValue.value;
    fromUnit.value = toUnit.value;
    toUnit.value = tmpUnit;
    fromValue.value = tmpVal || '0';
    convert();
    showToast('Units swapped');
  });

  // Copy result on click
  toValue.addEventListener('click', () => {
    if (toValue.value) {
      navigator.clipboard.writeText(toValue.value).then(() => {
        showToast('Result copied!');
      }).catch(() => {});
    }
  });

  /* ── Init ── */
  populateUnits();
  convert();
  renderReference();
});
