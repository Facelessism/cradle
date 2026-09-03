/**
 * Periodic Table Engine - Core calculation & filtering logic
 * Compatible with Node.js and Browser environments
 */

(function (exports) {
  /**
   * Converts temperature between Kelvin, Celsius, and Fahrenheit.
   * @param {number} value - Input temperature value
   * @param {string} fromUnit - 'K', 'C', or 'F'
   * @param {string} toUnit - 'K', 'C', or 'F'
   * @returns {number} Converted value rounded to 2 decimal places
   */
  function convertTemperature(value, fromUnit, toUnit) {
    if (typeof value !== "number" || isNaN(value)) return 0;
    let kelvin = value;

    if (fromUnit === "C") kelvin = value + 273.15;
    else if (fromUnit === "F") kelvin = (value - 32) * (5 / 9) + 273.15;

    let result = kelvin;
    if (toUnit === "C") result = kelvin - 273.15;
    else if (toUnit === "F") result = (kelvin - 273.15) * (9 / 5) + 32;

    return Math.round(result * 100) / 100;
  }

  /**
   * Determines the phase state of an element at a given temperature in Kelvin.
   * @param {number|null} melt - Melting point in Kelvin
   * @param {number|null} boil - Boiling point in Kelvin
   * @param {number} tempK - Target temperature in Kelvin
   * @param {string} phaseAtSTP - Fallback phase if thermal points missing
   * @returns {string} 'Solid' | 'Liquid' | 'Gas' | 'Synthetic'
   */
  function calculatePhaseState(melt, boil, tempK, phaseAtSTP = "Solid") {
    if (phaseAtSTP === "Synthetic" && !melt) {
      return "Synthetic";
    }

    if (!melt && !boil) return phaseAtSTP || "Solid";

    if (melt && tempK < melt) return "Solid";
    if (melt && boil && tempK >= melt && tempK < boil) return "Liquid";
    if (boil && tempK >= boil) return "Gas";
    if (melt && !boil && tempK >= melt) return "Liquid";
    return "Solid";
  }

  /**
   * Parses standard electron configuration strings into principal shell counts.
   * Example: "[Ne] 3s² 3p¹" -> [2, 8, 3]
   * @param {string} configStr - Electron configuration string
   * @returns {number[]} Array of electrons per shell (n=1, n=2, etc.)
   */
  function parseShellElectrons(configStr) {
    if (!configStr || typeof configStr !== "string") return [];

    // Normalize superscripts to normal digits
    const superscriptMap = { "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁰": "0" };
    const normalized = configStr.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, m => superscriptMap[m]);

    const nobleGases = {
      "[He]": [2],
      "[Ne]": [2, 8],
      "[Ar]": [2, 8, 8],
      "[Kr]": [2, 8, 18, 8],
      "[Xe]": [2, 8, 18, 18, 8],
      "[Rn]": [2, 8, 18, 32, 18, 8]
    };

    let baseShells = [];
    let remaining = normalized;

    for (const [symbol, shells] of Object.entries(nobleGases)) {
      if (normalized.includes(symbol)) {
        baseShells = [...shells];
        remaining = normalized.replace(symbol, "").trim();
        break;
      }
    }

    const orbitalRegex = /(\d)([spdfg])(\d+)/g;
    let match;
    const extraShells = {};

    while ((match = orbitalRegex.exec(remaining)) !== null) {
      const shellNum = parseInt(match[1], 10);
      const count = parseInt(match[3], 10);
      extraShells[shellNum] = (extraShells[shellNum] || 0) + count;
    }

    const maxExtra = Object.keys(extraShells).length ? Math.max(...Object.keys(extraShells).map(Number)) : 0;
    const totalShells = Math.max(baseShells.length, maxExtra);

    const result = [];
    for (let i = 1; i <= totalShells; i++) {
      const baseCount = baseShells[i - 1] || 0;
      const extraCount = extraShells[i] || 0;
      result.push(baseCount + extraCount);
    }

    return result;
  }

  /**
   * Filters array of element objects based on search criteria.
   * @param {Array} elements - List of element objects
   * @param {Object} options - Search & filter options
   * @returns {Array} Filtered elements array
   */
  function filterElements(elements, options = {}) {
    if (!Array.isArray(elements)) return [];
    const {
      search = "",
      category = "all",
      block = "all",
      tempK = 298,
      phaseFilter = "all"
    } = options;

    const query = search.trim().toLowerCase();

    return elements.filter(elem => {
      // Category match
      if (category !== "all" && elem.category !== category) {
        return false;
      }

      // Block match
      if (block !== "all" && elem.block !== block) {
        return false;
      }

      // Phase match at target temperature
      const currentPhase = calculatePhaseState(
        elem.meltingPoint,
        elem.boilingPoint,
        tempK,
        elem.phaseAtSTP
      );
      if (phaseFilter !== "all" && currentPhase.toLowerCase() !== phaseFilter.toLowerCase()) {
        return false;
      }

      // Text search match (Name, Symbol, Atomic Number, Category)
      if (query) {
        const nameMatch = elem.name.toLowerCase().includes(query);
        const symbolMatch = elem.symbol.toLowerCase().includes(query);
        const numberMatch = String(elem.number) === query;
        const categoryMatch = elem.category.toLowerCase().includes(query);
        return nameMatch || symbolMatch || numberMatch || categoryMatch;
      }

      return true;
    });
  }

  /**
   * Calculates overall periodic table stats & counts.
   * @param {Array} elements - Full elements list
   * @param {number} tempK - Current temperature in Kelvin
   * @returns {Object} Calculated stats summary
   */
  function calculateElementStats(elements, tempK = 298) {
    if (!Array.isArray(elements) || elements.length === 0) {
      return { total: 0, solid: 0, liquid: 0, gas: 0, synthetic: 0, categories: {} };
    }

    const stats = {
      total: elements.length,
      solid: 0,
      liquid: 0,
      gas: 0,
      synthetic: 0,
      categories: {}
    };

    elements.forEach(elem => {
      const state = calculatePhaseState(elem.meltingPoint, elem.boilingPoint, tempK, elem.phaseAtSTP);
      if (state === "Solid") stats.solid++;
      else if (state === "Liquid") stats.liquid++;
      else if (state === "Gas") stats.gas++;
      else if (state === "Synthetic") stats.synthetic++;

      stats.categories[elem.category] = (stats.categories[elem.category] || 0) + 1;
    });

    return stats;
  }

  exports.convertTemperature = convertTemperature;
  exports.calculatePhaseState = calculatePhaseState;
  exports.parseShellElectrons = parseShellElectrons;
  exports.filterElements = filterElements;
  exports.calculateElementStats = calculateElementStats;

})(typeof exports === "undefined" ? (window.PeriodicEngine = {}) : exports);
