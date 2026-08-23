import { isVaultReady } from './vault-ready.mjs';

// Voxel Vault production catalog.
// These are real-world products with official manufacturer/retailer pages.
// A source-verified product is NOT automatically a fulfillment-ready product.
// A physical checkout is enabled only when a licensed/authorized fulfillment
// mapping is configured in VOXEL_FULFILLMENT_CATALOG on the server.

const REAL_WORLD_OBJECTS = [
  {
    id: 'stanley-quencher-40oz', name: 'Stanley Quencher H2.0 40 oz', creator: 'Stanley', type: 'Artifact', category: 'drinkware', brand: 'Stanley', priceUsd: '45', rarity: 'Verified Object', material: 'Stainless steel', seed: 'stanley-quencher-40oz', realityBasis: 'real Stanley Quencher H2.0 40 oz travel tumbler', productStatus: 'source_verified', fulfillmentStatus: 'source_verified',
    modelEmbedUrl: 'https://sketchfab.com/models/735b3bf2277a4c11b2e09272f158cb77/embed?autostart=1&ui_theme=dark', modelSourceUrl: 'https://sketchfab.com/3d-models/stanley-tumbler-travel-cup-40-oz-735b3bf2277a4c11b2e09272f158cb77', modelLicense: 'CC BY', sourceUrl: 'https://www.stanley1913.com/products/adventure-quencher-travel-tumbler-40-oz', sourceName: 'Stanley official product page', sourceType: 'Official product page', description: 'Real Stanley Quencher product with a published model explicitly identified as a Quencher 2.0.'
  },
  {
    id: 'sony-wh1000xm5', name: 'Sony WH-1000XM5', creator: 'Sony', type: 'Artifact', category: 'audio', brand: 'Sony', priceUsd: '399', rarity: 'Verified Object', material: 'Polymer / leatherette', seed: 'sony-wh1000xm5', realityBasis: 'real Sony WH-1000XM5 wireless headphones', productStatus: 'source_verified', fulfillmentStatus: 'source_verified',
    modelEmbedUrl: 'https://sketchfab.com/models/5d8aea0a780b49fa89c9c205912414e3/embed?autostart=1&ui_theme=dark', modelSourceUrl: 'https://sketchfab.com/3d-models/sony-wh-1000xm5-5d8aea0a780b49fa89c9c205912414e3', modelLicense: 'CC BY', sourceUrl: 'https://electronics.sony.com/audio/headphones/headband/p/wh1000xm5-b', sourceName: 'Sony official product page', sourceType: 'Official product page', description: 'Real Sony WH-1000XM5 product with a published model explicitly identified as the same product.'
  },
  {
    id: 'apple-airpods-pro', name: 'Apple AirPods Pro', creator: 'Apple', type: 'Artifact', category: 'audio', brand: 'Apple', priceUsd: '249', rarity: 'Verified Object', material: 'Polycarbonate', seed: 'apple-airpods-pro', realityBasis: 'real Apple AirPods Pro earbuds and charging case', productStatus: 'source_verified', fulfillmentStatus: 'source_verified',
    modelEmbedUrl: 'https://sketchfab.com/models/40b434f607e24f52925dc27877751f1a/embed?autostart=1&ui_theme=dark', modelSourceUrl: 'https://sketchfab.com/3d-models/air-pods-pro-40b434f607e24f52925dc27877751f1a', modelLicense: 'Attribution on model page', sourceUrl: 'https://www.apple.com/airpods-pro/', sourceName: 'Apple official product page', sourceType: 'Official product page', description: 'Real Apple AirPods Pro product; the model listing says it was exported from Apple AR product media.'
  },
  {
    id: 'nike-air-force-1', name: 'Nike Air Force 1', creator: 'Nike', type: 'Artifact', category: 'footwear', brand: 'Nike', priceUsd: '115', rarity: 'Verified Object', material: 'Leather / rubber', seed: 'nike-air-force-1', realityBasis: 'real Nike Air Force 1 sneaker', productStatus: 'source_verified', fulfillmentStatus: 'source_verified',
    modelEmbedUrl: 'https://sketchfab.com/models/b580fb8a337e4609807185f1fab2f305/embed?autostart=1&ui_theme=dark', modelSourceUrl: 'https://sketchfab.com/3d-models/nike-air-force-1-b580fb8a337e4609807185f1fab2f305', modelLicense: 'CC BY', sourceUrl: 'https://www.nike.com/w/air-force-1-shoes-5sjg7zy7ok', sourceName: 'Nike official shopping page', sourceType: 'Official shopping page', description: 'Real Nike Air Force 1 product family with a published 3D model explicitly identified as an Air Force 1 sneaker.'
  },
  {
    id: 'apple-iphone-15-pro', name: 'Apple iPhone 15 Pro', creator: 'Apple', type: 'Artifact', category: 'electronics', brand: 'Apple', priceUsd: '999', rarity: 'Verified Object', material: 'Titanium / glass', seed: 'apple-iphone-15-pro', realityBasis: 'real Apple iPhone 15 Pro smartphone', productStatus: 'source_verified', fulfillmentStatus: 'source_verified',
    modelEmbedUrl: 'https://sketchfab.com/models/9e045e469d514fea9dda2ccd161f5fa3/embed?autostart=1&ui_theme=dark', modelSourceUrl: 'https://sketchfab.com/3d-models/iphone-15-pro-9e045e469d514fea9dda2ccd161f5fa3', modelLicense: 'CC BY', sourceUrl: 'https://www.apple.com/iphone-15-pro/', sourceName: 'Apple product information', sourceType: 'Official product page', description: 'Real iPhone 15 Pro product with a published model explicitly identified as the iPhone 15 Pro.'
  },
  {
    id: 'sony-playstation-5', name: 'Sony PlayStation 5', creator: 'Sony Interactive Entertainment', type: 'Artifact', category: 'gaming', brand: 'PlayStation', priceUsd: '499', rarity: 'Verified Object', material: 'Polycarbonate / metal', seed: 'sony-playstation-5', realityBasis: 'real Sony PlayStation 5 console', productStatus: 'source_verified', fulfillmentStatus: 'source_verified',
    modelEmbedUrl: 'https://sketchfab.com/models/8e602d71ddc94bf09731db9151fc7cd3/embed?autostart=1&ui_theme=dark', modelSourceUrl: 'https://sketchfab.com/3d-models/playstation-5-set-8e602d71ddc94bf09731db9151fc7cd3', modelLicense: 'CC BY', sourceUrl: 'https://direct.playstation.com/en-us/buy-consoles/playstation5-console-1tb', sourceName: 'PlayStation Direct', sourceType: 'Official shopping page', description: 'Real PlayStation 5 console represented by a published PS5 set model containing the console and DualSense controller.'
  },
  {
    id: 'gopro-hero', name: 'GoPro HERO action camera', creator: 'GoPro', type: 'Artifact', category: 'camera', brand: 'GoPro', priceUsd: '299', rarity: 'Verified Object', material: 'Polycarbonate / glass', seed: 'gopro-hero', realityBasis: 'real GoPro HERO-family action camera', productStatus: 'source_verified', fulfillmentStatus: 'source_verified',
    modelEmbedUrl: 'https://sketchfab.com/models/507cf5adab234062a2fa00d3e1f82dca/embed?autostart=1&ui_theme=dark', modelSourceUrl: 'https://sketchfab.com/3d-models/gopro-hero-full-hd-action-camera-507cf5adab234062a2fa00d3e1f82dca', modelLicense: 'Attribution on model page', sourceUrl: 'https://gopro.com/en/us/shop/cameras', sourceName: 'GoPro official camera shop', sourceType: 'Official shopping page', description: 'Real GoPro HERO-family action camera represented by a detailed model explicitly based on GoPro HERO design.'
  },
  {
    id: 'rolex-submariner', name: 'Rolex Submariner', creator: 'Rolex', type: 'Artifact', category: 'watches', brand: 'Rolex', priceUsd: '10000+', rarity: 'Verified Object', material: 'Steel / ceramic', seed: 'rolex-submariner', realityBasis: 'real Rolex Submariner watch family', productStatus: 'source_verified', fulfillmentStatus: 'source_verified',
    modelEmbedUrl: 'https://sketchfab.com/models/0fde5c5f56d841cda53ae4a01f66dfaf/embed?autostart=1&ui_theme=dark', modelSourceUrl: 'https://sketchfab.com/3d-models/rolex-watch-0fde5c5f56d841cda53ae4a01f66dfaf', modelLicense: 'CC BY', sourceUrl: 'https://www.rolex.com/watches/submariner', sourceName: 'Rolex official collection', sourceType: 'Official product page', description: 'Real Rolex Submariner family object with a published Submariner model.'
  },
  {
    id: 'iphone-15-pro-alt', name: 'Apple iPhone 15 Pro Titanium', creator: 'Apple', type: 'Artifact', category: 'electronics', brand: 'Apple', priceUsd: '999', rarity: 'Verified Object', material: 'Titanium / glass', seed: 'iphone-15-pro-alt', realityBasis: 'real Apple iPhone 15 Pro smartphone colorway', productStatus: 'source_verified', fulfillmentStatus: 'source_verified',
    modelEmbedUrl: 'https://sketchfab.com/models/6fd1283ec05d412d99a3f23b2e80e473/embed?autostart=1&ui_theme=dark', modelSourceUrl: 'https://sketchfab.com/3d-models/apple-iphone-15-pro-black-6fd1283ec05d412d99a3f23b2e80e473', modelLicense: 'CC BY', sourceUrl: 'https://www.apple.com/iphone-15-pro/', sourceName: 'Apple product information', sourceType: 'Official product page', description: 'A second published iPhone 15 Pro model, representing another real-world colorway.'
  }
];

export function getCatalogItem(index) { return REAL_WORLD_OBJECTS[index] || null; }
export function getCatalogWindow(start = 0, count = REAL_WORLD_OBJECTS.length) { return REAL_WORLD_OBJECTS.slice(start, start + count); }
export function getCatalog() { return [...REAL_WORLD_OBJECTS]; }
export function getSellableCatalog() { return REAL_WORLD_OBJECTS.filter(isVaultReady); }
export const CATALOG_SIZE = REAL_WORLD_OBJECTS.length;
