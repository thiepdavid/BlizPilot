import type { BusinessType } from '../types';

export type BusinessTypeProfile = {
  name: string;
  inventoryDescription: string;
  itemLabel: string;
  itemPlural: string;
  variantMetricLabel: string;
  variantDescription: string;
  optionLabels: [string, string];
  inventoryCategories: string[];
  expenseCategories: string[];
};

const sharedExpenses = ['Rent', 'Utilities', 'Travel', 'Marketing', 'Equipment', 'Other'];

export const businessTypeProfiles: Record<BusinessType, BusinessTypeProfile> = {
  boutique: {
    name: 'Boutique / clothing & fashion',
    inventoryDescription: 'Track clothing products by size and color, and catch low stock early.',
    itemLabel: 'Product', itemPlural: 'Products', variantMetricLabel: 'Product variants', variantDescription: 'Create one row for each size and color combination.',
    optionLabels: ['Size', 'Color'],
    inventoryCategories: ['Clothing', 'Footwear', 'Bags', 'Jewelry', 'Accessories'],
    expenseCategories: ['Inventory', 'Supplies', ...sharedExpenses],
  },
  restaurant: {
    name: 'Restaurant / café',
    inventoryDescription: 'Track menu items, ingredients, drinks, and packaging with costs and stock levels.',
    itemLabel: 'Menu item or ingredient', itemPlural: 'Menu items and stock', variantMetricLabel: 'Stock items', variantDescription: 'Use one row for each ingredient, menu item, or packaging item you track.',
    optionLabels: ['Portion / pack size', 'Preparation / variant'],
    inventoryCategories: ['Food', 'Drinks', 'Ingredients', 'Prepared meals', 'Packaging', 'Cleaning'],
    expenseCategories: ['Food and ingredients', 'Beverages', 'Packaging', 'Kitchen supplies', 'Equipment', ...sharedExpenses],
  },
  salon: {
    name: 'Salon / personal services',
    inventoryDescription: 'Track retail products and service supplies, alongside your services and appointments.',
    itemLabel: 'Product or supply', itemPlural: 'Products and supplies', variantMetricLabel: 'Stock items', variantDescription: 'Track each retail product or service supply; add a row for each size or type.',
    optionLabels: ['Size / format', 'Product type'],
    inventoryCategories: ['Hair care', 'Skin care', 'Nail care', 'Tools', 'Retail products', 'Consumables'],
    expenseCategories: ['Products and supplies', 'Tools', 'Equipment', 'Laundry', ...sharedExpenses],
  },
  grocery: {
    name: 'Grocery / convenience store',
    inventoryDescription: 'Track packaged goods, produce, drinks, and everyday essentials with stock alerts.',
    itemLabel: 'Store item', itemPlural: 'Store items', variantMetricLabel: 'Stock items', variantDescription: 'Track each sellable item or pack size as its own row.',
    optionLabels: ['Pack size / unit', 'Flavor / variety'],
    inventoryCategories: ['Produce', 'Dairy', 'Bakery', 'Pantry', 'Frozen', 'Beverages', 'Household'],
    expenseCategories: ['Goods for resale', 'Produce', 'Dairy and bakery', 'Packaging', 'Store supplies', ...sharedExpenses],
  },
  electronics: {
    name: 'Electronics',
    inventoryDescription: 'Track devices and accessories by model, SKU, cost, selling price, and stock.',
    itemLabel: 'Product', itemPlural: 'Products', variantMetricLabel: 'Product variants', variantDescription: 'Create a row for each model or product variation you stock.',
    optionLabels: ['Model', 'Color / variant'],
    inventoryCategories: ['Phones', 'Computers', 'Audio', 'Accessories', 'Appliances', 'Gaming'],
    expenseCategories: ['Stock for resale', 'Accessories', 'Repairs', 'Equipment', ...sharedExpenses],
  },
  pharmacy: {
    name: 'Pharmacy',
    inventoryDescription: 'Track product stock, pack sizes, SKUs, costs, and prices. Use your approved pharmacy system for dispensing and compliance records.',
    itemLabel: 'Product', itemPlural: 'Products', variantMetricLabel: 'Stock items', variantDescription: 'Track each product strength or pack size as a separate stock row.',
    optionLabels: ['Strength', 'Pack size'],
    inventoryCategories: ['Prescription medicines', 'Over-the-counter', 'First aid', 'Personal care', 'Wellness', 'Medical supplies'],
    expenseCategories: ['Stock for resale', 'Medical supplies', 'Storage', 'Equipment', ...sharedExpenses],
  },
  other: {
    name: 'Other business',
    inventoryDescription: 'Track products, materials, stock costs, and low-stock levels for your business.',
    itemLabel: 'Item', itemPlural: 'Items', variantMetricLabel: 'Inventory items', variantDescription: 'Use one row for each item or variation you want to track.',
    optionLabels: ['Option 1', 'Option 2'],
    inventoryCategories: ['Materials', 'Products', 'Supplies', 'Equipment', 'Other'],
    expenseCategories: ['Supplies', ...sharedExpenses],
  },
};

export function getBusinessTypeProfile(type: BusinessType): BusinessTypeProfile {
  return businessTypeProfiles[type] ?? businessTypeProfiles.other;
}
