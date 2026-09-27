import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from './lib/admin';

const { db, prod, projectId } = initAdmin();

const BUNDLE_LACES = [
  {
    id: 'LC280-01',
    styleCode: 'TC-BD280',
    colourName: 'Metallic Silver',
    hex: '#D1D5DB',
    name: 'Metallic Silver Braided Cable Gota Lace Border',
    description: 'Artisanal metallic silver braided rope and cable plait gota lace border. Elegant lustrous finish perfect for dupattas, blouses, lehengas, and festive borders. Sold as a complete 9-meter bundle for ₹250.',
    tags: ['Lace', 'Gota', 'Silver', 'Metallic', 'Braided', '9m Bundle', 'Festive'],
    unitType: 'unit',
    bundleSizeMeters: 9,
    bundlePrice: 250,
    price: 250,
    sellingPricePerMeter: null,
    mrp: 399,
    materialType: 'Metallic Silver Zari & Gota Braid',
    stock: 10,
    photo: '/products/lace/LC280-01.jpg',
    photoGallery: ['/products/lace/LC280-01.jpg']
  },
  {
    id: 'LC280-02',
    styleCode: 'TC-BD280',
    colourName: 'Antique Gold Chevron',
    hex: '#C6A15C',
    name: 'Antique Gold Scallop Chevron Gota Patti Lace Border',
    description: 'Exquisite antique gold triangular chevron and scalloped wave gota patti border lace. Traditional craftsmanship ideal for sarees, anarkalis, and ceremonial ensembles. Sold as a complete 9-meter bundle for ₹250.',
    tags: ['Lace', 'Gota Patti', 'Gold', 'Antique Gold', 'Chevron', 'Scallop', '9m Bundle', 'Traditional'],
    unitType: 'unit',
    bundleSizeMeters: 9,
    bundlePrice: 250,
    price: 250,
    sellingPricePerMeter: null,
    mrp: 399,
    materialType: 'Antique Gold Gota Patti & Zari',
    stock: 10,
    photo: '/products/lace/LC280-02.jpg',
    photoGallery: ['/products/lace/LC280-02.jpg']
  },
  {
    id: 'LC280-03',
    styleCode: 'TC-BD280',
    colourName: 'Antique Gold Scallop',
    hex: '#C5A059',
    name: 'Antique Gold Scalloped Cord & Pleated Zari Lace Border',
    description: 'Opulent antique gold zari lace border featuring a contoured scalloped cord wave edge and raised pleated geometric chevron track on fine mesh. Sold as a complete 9-meter bundle for ₹280.',
    tags: ['Lace', 'Zari', 'Gold', 'Antique Gold', 'Scallop', 'Cordwork', '9m Bundle', 'Festive'],
    unitType: 'unit',
    bundleSizeMeters: 9,
    bundlePrice: 280,
    price: 280,
    sellingPricePerMeter: null,
    mrp: 450,
    materialType: 'Antique Gold Zari, Metallic Cord & Mesh',
    stock: 10,
    photo: '/products/lace/LC280-03.jpg',
    photoGallery: ['/products/lace/LC280-03.jpg']
  }
];

async function main() {
  console.log(`🌸 Seeding unified styleCode "TC-BD280" to Firestore (Target: ${prod ? 'PRODUCTION' : 'EMULATOR'} "${projectId}")...\n`);

  const batch = db.batch();

  // Clean up old duplicate IDs if they exist
  batch.delete(db.collection('products').doc('LC250-01'));
  batch.delete(db.collection('products').doc('LC250-02'));

  for (const l of BUNDLE_LACES) {
    const ref = db.collection('products').doc(l.id);
    batch.set(ref, {
      id: l.id,
      brand: 'TRESOR',
      name: l.name,
      title: l.name,
      productCode: l.id,
      styleCode: l.styleCode,
      colourName: l.colourName,
      description: l.description,
      price: l.price,
      sellingPricePerMeter: null,
      bundlePrice: l.bundlePrice,
      bundleSizeMeters: l.bundleSizeMeters,
      mrp: l.mrp,
      photo: l.photo,
      photoGallery: l.photoGallery,
      image: l.photo,
      gallery: l.photoGallery,
      category: 'Laces',
      masterCategory: 'Laces',
      subCategory: 'Trim & Edging',
      materialType: l.materialType,
      colors: [{ name: l.colourName, hex: l.hex }],
      tags: l.tags,
      stock: l.stock,
      unitType: l.unitType,
      listingStatus: 'Active',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`  + ${l.id.padEnd(10)} [${l.styleCode}] ${l.name} (${l.colourName}) - ₹${l.price}`);
  }

  await batch.commit();
  console.log(`\n🎉 Successfully unified all 3 colourways under TC-BD280 in Firestore!`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
