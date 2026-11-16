/**
 * MedRemind Built-in Food & Nutrition Catalog
 * Focus on Indian regional staples and common balanced diet foods.
 * Provides instant 100% offline nutritional calculation.
 */

export const FOOD_CATALOG = [
  {
    id: 'roti-wheat',
    name: 'Roti / Chapati (Whole Wheat)',
    aliases: ['chapati', 'phulka', 'roti', 'flatbread', 'gehu roti'],
    category: 'Grains & Breads',
    defaultUnit: 'pieces',
    supportedUnits: [
      { unit: 'pieces', factor: 1, label: '1 piece (~35g)' },
      { unit: 'grams', factor: 1 / 35, label: 'Grams' }
    ],
    perUnit: {
      calories: 104,
      protein: 3.1,
      carbs: 20.2,
      fat: 0.5,
      fibre: 2.8
    }
  },
  {
    id: 'rice-white-cooked',
    name: 'Cooked White Rice',
    aliases: ['rice', 'white rice', 'chawal', 'steamed rice', 'boiled rice'],
    category: 'Grains & Breads',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~150g)' },
      { unit: 'bowls', factor: 1.2, label: '1 bowl (~180g)' },
      { unit: 'grams', factor: 1 / 150, label: 'Grams' }
    ],
    perUnit: {
      calories: 195,
      protein: 4.2,
      carbs: 43.0,
      fat: 0.4,
      fibre: 0.6
    }
  },
  {
    id: 'rice-brown-cooked',
    name: 'Cooked Brown Rice',
    aliases: ['brown rice'],
    category: 'Grains & Breads',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~150g)' },
      { unit: 'grams', factor: 1 / 150, label: 'Grams' }
    ],
    perUnit: {
      calories: 165,
      protein: 3.5,
      carbs: 35.0,
      fat: 1.4,
      fibre: 2.8
    }
  },
  {
    id: 'dal-tadka',
    name: 'Yellow Dal / Dal Tadka',
    aliases: ['dal', 'daal', 'dal tadka', 'toor dal', 'moong dal', 'arhar dal', 'yellow dal'],
    category: 'Lentils & Legumes',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup / katori (~200g)' },
      { unit: 'bowls', factor: 1.25, label: '1 large bowl (~250g)' },
      { unit: 'grams', factor: 1 / 200, label: 'Grams' }
    ],
    perUnit: {
      calories: 175,
      protein: 9.2,
      carbs: 24.5,
      fat: 4.6,
      fibre: 6.0
    }
  },
  {
    id: 'dal-makhani',
    name: 'Dal Makhani',
    aliases: ['dal makhani', 'makhani dal', 'urad dal'],
    category: 'Lentils & Legumes',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~200g)' },
      { unit: 'grams', factor: 1 / 200, label: 'Grams' }
    ],
    perUnit: {
      calories: 280,
      protein: 10.0,
      carbs: 30.0,
      fat: 14.0,
      fibre: 6.5
    }
  },
  {
    id: 'sambar',
    name: 'Sambar',
    aliases: ['sambhar', 'sambar'],
    category: 'Lentils & Legumes',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup / bowl (~200g)' },
      { unit: 'grams', factor: 1 / 200, label: 'Grams' }
    ],
    perUnit: {
      calories: 130,
      protein: 5.8,
      carbs: 20.0,
      fat: 3.2,
      fibre: 4.5
    }
  },
  {
    id: 'idli',
    name: 'Plain Idli',
    aliases: ['idli', 'steamed idli'],
    category: 'Breakfast Staples',
    defaultUnit: 'pieces',
    supportedUnits: [
      { unit: 'pieces', factor: 1, label: '1 piece (~40g)' },
      { unit: 'plates', factor: 2, label: '1 plate (2 pcs)' }
    ],
    perUnit: {
      calories: 58,
      protein: 2.0,
      carbs: 12.0,
      fat: 0.2,
      fibre: 0.8
    }
  },
  {
    id: 'dosa-plain',
    name: 'Plain Dosa',
    aliases: ['dosa', 'sada dosa', 'plain dosa'],
    category: 'Breakfast Staples',
    defaultUnit: 'pieces',
    supportedUnits: [
      { unit: 'pieces', factor: 1, label: '1 medium dosa (~80g)' }
    ],
    perUnit: {
      calories: 160,
      protein: 3.8,
      carbs: 28.0,
      fat: 3.7,
      fibre: 1.2
    }
  },
  {
    id: 'dosa-masala',
    name: 'Masala Dosa',
    aliases: ['masala dosa'],
    category: 'Breakfast Staples',
    defaultUnit: 'pieces',
    supportedUnits: [
      { unit: 'pieces', factor: 1, label: '1 masala dosa (~150g)' }
    ],
    perUnit: {
      calories: 285,
      protein: 5.5,
      carbs: 42.0,
      fat: 10.5,
      fibre: 3.2
    }
  },
  {
    id: 'poha',
    name: 'Poha (Flattened Rice)',
    aliases: ['poha', 'kanda poha', 'aval'],
    category: 'Breakfast Staples',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~150g)' },
      { unit: 'plates', factor: 1.5, label: '1 plate (~220g)' }
    ],
    perUnit: {
      calories: 180,
      protein: 3.5,
      carbs: 32.0,
      fat: 4.5,
      fibre: 2.1
    }
  },
  {
    id: 'upma',
    name: 'Upma (Semolina / Rava)',
    aliases: ['upma', 'uppumavu', 'rava upma'],
    category: 'Breakfast Staples',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~150g)' }
    ],
    perUnit: {
      calories: 195,
      protein: 4.5,
      carbs: 34.0,
      fat: 5.0,
      fibre: 2.5
    }
  },
  {
    id: 'khichdi',
    name: 'Moong Dal Khichdi',
    aliases: ['khichdi', 'khichri', 'dal khichdi'],
    category: 'Main Dishes',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~200g)' },
      { unit: 'bowls', factor: 1.3, label: '1 bowl (~260g)' }
    ],
    perUnit: {
      calories: 210,
      protein: 8.0,
      carbs: 36.0,
      fat: 4.0,
      fibre: 4.0
    }
  },
  {
    id: 'paneer-cooked',
    name: 'Paneer Sabzi / Bhurji',
    aliases: ['paneer', 'cottage cheese', 'paneer bhurji', 'paneer butter masala', 'matar paneer'],
    category: 'Dairy & Vegetarian Protein',
    defaultUnit: 'grams',
    supportedUnits: [
      { unit: 'grams', factor: 1 / 100, label: '100g' },
      { unit: 'cups', factor: 1.5, label: '1 cup (~150g)' }
    ],
    perUnit: {
      calories: 240,
      protein: 14.2,
      carbs: 5.1,
      fat: 18.0,
      fibre: 0.5
    }
  },
  {
    id: 'palak-paneer',
    name: 'Palak Paneer',
    aliases: ['palak paneer', 'spinach paneer'],
    category: 'Dairy & Vegetarian Protein',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~200g)' }
    ],
    perUnit: {
      calories: 260,
      protein: 12.0,
      carbs: 9.0,
      fat: 19.0,
      fibre: 4.2
    }
  },
  {
    id: 'curd-plain',
    name: 'Plain Curd / Dahi',
    aliases: ['curd', 'dahi', 'yogurt', 'plain yogurt'],
    category: 'Dairy & Vegetarian Protein',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~150g)' },
      { unit: 'bowls', factor: 1, label: '1 katori (~150g)' }
    ],
    perUnit: {
      calories: 90,
      protein: 6.0,
      carbs: 7.0,
      fat: 4.5,
      fibre: 0
    }
  },
  {
    id: 'sabzi-mixed',
    name: 'Mixed Vegetable Sabzi (Aloo Gobi/Beans)',
    aliases: ['sabzi', 'subzi', 'aloo gobi', 'bhindi', 'mix veg', 'tarkari'],
    category: 'Vegetables & Curries',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~150g)' },
      { unit: 'bowls', factor: 1, label: '1 katori (~150g)' }
    ],
    perUnit: {
      calories: 135,
      protein: 3.5,
      carbs: 18.0,
      fat: 6.0,
      fibre: 4.2
    }
  },
  {
    id: 'rajma-curry',
    name: 'Rajma Curry (Kidney Beans)',
    aliases: ['rajma', 'rajma chawal', 'red kidney beans'],
    category: 'Lentils & Legumes',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~200g)' }
    ],
    perUnit: {
      calories: 220,
      protein: 12.0,
      carbs: 34.0,
      fat: 4.0,
      fibre: 8.5
    }
  },
  {
    id: 'chhole-curry',
    name: 'Chhole / Chickpea Curry',
    aliases: ['chhole', 'chole', 'chana masala', 'chickpea curry'],
    category: 'Lentils & Legumes',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~200g)' }
    ],
    perUnit: {
      calories: 245,
      protein: 11.0,
      carbs: 36.0,
      fat: 6.5,
      fibre: 7.5
    }
  },
  {
    id: 'egg-boiled',
    name: 'Boiled Egg',
    aliases: ['egg', 'boiled egg', 'anda'],
    category: 'Non-Vegetarian & Eggs',
    defaultUnit: 'pieces',
    supportedUnits: [
      { unit: 'pieces', factor: 1, label: '1 large egg (~50g)' }
    ],
    perUnit: {
      calories: 78,
      protein: 6.3,
      carbs: 0.6,
      fat: 5.3,
      fibre: 0
    }
  },
  {
    id: 'egg-omelette',
    name: 'Egg Omelette',
    aliases: ['omelette', 'omelet', 'egg omelette'],
    category: 'Non-Vegetarian & Eggs',
    defaultUnit: 'pieces',
    supportedUnits: [
      { unit: 'pieces', factor: 1, label: '1 egg omelette' }
    ],
    perUnit: {
      calories: 115,
      protein: 7.0,
      carbs: 2.0,
      fat: 8.5,
      fibre: 0.4
    }
  },
  {
    id: 'chicken-curry',
    name: 'Chicken Curry',
    aliases: ['chicken curry', 'chicken', 'murgh'],
    category: 'Non-Vegetarian & Eggs',
    defaultUnit: 'grams',
    supportedUnits: [
      { unit: 'grams', factor: 1 / 100, label: '100g serving' },
      { unit: 'pieces', factor: 0.8, label: '1 piece with gravy (~80g)' },
      { unit: 'cups', factor: 1.5, label: '1 cup (~150g)' }
    ],
    perUnit: {
      calories: 180,
      protein: 20.0,
      carbs: 4.0,
      fat: 9.0,
      fibre: 1.0
    }
  },
  {
    id: 'chicken-breast',
    name: 'Grilled / Boiled Chicken Breast',
    aliases: ['chicken breast', 'grilled chicken', 'boiled chicken'],
    category: 'Non-Vegetarian & Eggs',
    defaultUnit: 'grams',
    supportedUnits: [
      { unit: 'grams', factor: 1 / 100, label: '100g serving' }
    ],
    perUnit: {
      calories: 165,
      protein: 31.0,
      carbs: 0,
      fat: 3.6,
      fibre: 0
    }
  },
  {
    id: 'fish-curry',
    name: 'Fish Curry',
    aliases: ['fish curry', 'fish'],
    category: 'Non-Vegetarian & Eggs',
    defaultUnit: 'grams',
    supportedUnits: [
      { unit: 'grams', factor: 1 / 100, label: '100g serving' },
      { unit: 'pieces', factor: 1, label: '1 piece (~100g)' }
    ],
    perUnit: {
      calories: 155,
      protein: 18.0,
      carbs: 3.0,
      fat: 7.5,
      fibre: 0.5
    }
  },
  {
    id: 'fruit-apple',
    name: 'Fresh Apple',
    aliases: ['apple', 'seb'],
    category: 'Fruits & Salads',
    defaultUnit: 'pieces',
    supportedUnits: [
      { unit: 'pieces', factor: 1, label: '1 medium apple (~150g)' },
      { unit: 'grams', factor: 1 / 150, label: 'Grams' }
    ],
    perUnit: {
      calories: 78,
      protein: 0.4,
      carbs: 20.0,
      fat: 0.2,
      fibre: 3.6
    }
  },
  {
    id: 'fruit-banana',
    name: 'Fresh Banana',
    aliases: ['banana', 'kela'],
    category: 'Fruits & Salads',
    defaultUnit: 'pieces',
    supportedUnits: [
      { unit: 'pieces', factor: 1, label: '1 medium banana (~120g)' }
    ],
    perUnit: {
      calories: 105,
      protein: 1.3,
      carbs: 27.0,
      fat: 0.3,
      fibre: 3.1
    }
  },
  {
    id: 'milk-toned',
    name: 'Milk (Toned)',
    aliases: ['milk', 'doodh', 'toned milk', 'cow milk'],
    category: 'Beverages',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 glass / cup (200ml)' },
      { unit: 'ml', factor: 1 / 200, label: 'Milliliters (ml)' }
    ],
    perUnit: {
      calories: 120,
      protein: 6.4,
      carbs: 9.6,
      fat: 6.0,
      fibre: 0
    }
  },
  {
    id: 'chai-tea',
    name: 'Chai / Indian Tea (Milk & Sugar)',
    aliases: ['tea', 'chai', 'milk tea'],
    category: 'Beverages',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~150ml)' }
    ],
    perUnit: {
      calories: 65,
      protein: 2.0,
      carbs: 9.0,
      fat: 2.2,
      fibre: 0
    }
  },
  {
    id: 'salad-green',
    name: 'Green Salad (Cucumber, Tomato, Carrot)',
    aliases: ['salad', 'cucumber', 'kheera', 'kachumber'],
    category: 'Fruits & Salads',
    defaultUnit: 'bowls',
    supportedUnits: [
      { unit: 'bowls', factor: 1, label: '1 small bowl (~150g)' },
      { unit: 'plates', factor: 1.5, label: '1 plate (~225g)' }
    ],
    perUnit: {
      calories: 35,
      protein: 1.5,
      carbs: 7.0,
      fat: 0.3,
      fibre: 2.5
    }
  },
  {
    id: 'oats-cooked',
    name: 'Rolled Oats (Cooked)',
    aliases: ['oats', 'oatmeal', 'porridge'],
    category: 'Breakfast Staples',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~200g)' }
    ],
    perUnit: {
      calories: 145,
      protein: 5.5,
      carbs: 27.0,
      fat: 2.5,
      fibre: 4.0
    }
  },
  {
    id: 'almonds',
    name: 'Almonds / Badam',
    aliases: ['almonds', 'badam', 'nuts'],
    category: 'Snacks & Nuts',
    defaultUnit: 'pieces',
    supportedUnits: [
      { unit: 'pieces', factor: 1 / 10, label: '10 pieces (~12g)' },
      { unit: 'grams', factor: 1 / 12, label: 'Grams' }
    ],
    perUnit: {
      calories: 70,
      protein: 2.5,
      carbs: 2.5,
      fat: 6.0,
      fibre: 1.5
    }
  },
  {
    id: 'sprouts-moong',
    name: 'Sprouted Green Moong Salad',
    aliases: ['sprouts', 'moong sprouts', 'ankurit moong'],
    category: 'Fruits & Salads',
    defaultUnit: 'cups',
    supportedUnits: [
      { unit: 'cups', factor: 1, label: '1 cup (~100g)' }
    ],
    perUnit: {
      calories: 105,
      protein: 7.5,
      carbs: 18.0,
      fat: 0.5,
      fibre: 4.0
    }
  }
];

/**
 * Search the local catalog for matching foods
 */
export function searchFoodCatalog(query) {
  if (!query || typeof query !== 'string') return [];
  const clean = query.trim().toLowerCase();
  if (clean.length === 0) return FOOD_CATALOG.slice(0, 10);

  return FOOD_CATALOG.filter(item => {
    if (item.name.toLowerCase().includes(clean)) return true;
    if (item.category.toLowerCase().includes(clean)) return true;
    if (item.aliases && item.aliases.some(a => a.toLowerCase().includes(clean))) return true;
    return false;
  });
}

/**
 * Calculate nutrition for a catalog item based on quantity and unit
 */
export function calculateItemNutrition(catalogItem, quantity = 1, unit = null) {
  if (!catalogItem || !catalogItem.perUnit) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fibre: 0
    };
  }

  const selectedUnit = unit || catalogItem.defaultUnit;
  const unitConfig = catalogItem.supportedUnits?.find(u => u.unit === selectedUnit);
  const factor = unitConfig ? unitConfig.factor : 1;
  const qty = Number(quantity) || 1;

  const multiplier = qty * factor;

  return {
    calories: Math.round(catalogItem.perUnit.calories * multiplier),
    protein: Math.round(catalogItem.perUnit.protein * multiplier * 10) / 10,
    carbs: Math.round(catalogItem.perUnit.carbs * multiplier * 10) / 10,
    fat: Math.round(catalogItem.perUnit.fat * multiplier * 10) / 10,
    fibre: Math.round(catalogItem.perUnit.fibre * multiplier * 10) / 10
  };
}

/**
 * Compute calorie contribution percentages for macros:
 * Protein: 4 kcal/g
 * Carbs: 4 kcal/g
 * Fat: 9 kcal/g
 */
export function calculateMacroPercentages(proteinG = 0, carbsG = 0, fatG = 0) {
  const proteinKcal = (Number(proteinG) || 0) * 4;
  const carbsKcal = (Number(carbsG) || 0) * 4;
  const fatKcal = (Number(fatG) || 0) * 9;
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal;

  if (totalMacroKcal <= 0) {
    return {
      proteinPct: 0,
      carbsPct: 0,
      fatPct: 0,
      totalMacroKcal: 0
    };
  }

  return {
    proteinPct: Math.round((proteinKcal / totalMacroKcal) * 100),
    carbsPct: Math.round((carbsKcal / totalMacroKcal) * 100),
    fatPct: Math.round((fatKcal / totalMacroKcal) * 100),
    totalMacroKcal
  };
}
