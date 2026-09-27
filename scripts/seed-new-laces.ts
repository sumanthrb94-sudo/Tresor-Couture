import { FieldValue } from 'firebase-admin/firestore';
import { initAdmin } from './lib/admin';

const { db, prod, projectId } = initAdmin();

const NEW_LACES = [
  {
    id: 'LC250-01',
    styleCode: 'TC-BR250',
    colourName: 'Metallic Silver',
    hex: '#D1D5DB',
    name: 'Metallic Silver Braided Cable Gota Lace Border',
    description: 'Artisanal metallic silver braided rope and cable plait gota lace border. Elegant lustrous finish perfect for dupattas, blouses, lehengas, and festive borders. Available at ₹85/meter or ₹250 for a full 9-meter bundle.',
    tags: ['Lace', 'Gota', 'Silver', 'Metallic', 'Braided', 'Per Meter', '9m Bundle', 'Festive'],
    unitType: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 250,
    price: 85,
    sellingPricePerMeter: 85,
    mrp: 150,
    materialType: 'Metallic Silver Zari & Gota Braid',
    stock: 90,
    photo: '/products/lace/LC250-01.jpg',
    photoGallery: ['/products/lace/LC250-01.jpg']
  },
  {
    id: 'LC250-02',
    styleCode: 'TC-CH250',
    colourName: 'Antique Gold',
    hex: '#C6A15C',
    name: 'Antique Gold Scallop Chevron Gota Patti Lace Border',
    description: 'Exquisite antique gold triangular chevron and scalloped wave gota patti border lace. Traditional craftsmanship ideal for sarees, anarkalis, and ceremonial ensembles. Available at ₹85/meter or ₹250 for a full 9-meter bundle.',
    tags: ['Lace', 'Gota Patti', 'Gold', 'Antique Gold', 'Chevron', 'Scallop', 'Per Meter', '9m Bundle', 'Traditional'],
    unitType: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 250,
    price: 85,
    sellingPricePerMeter: 85,
    mrp: 150,
    materialType: 'Antique Gold Gota Patti & Zari',
    stock: 90,
    photo: '/products/lace/LC250-02.jpg',
    photoGallery: ['/products/lace/LC250-02.jpg']
  },
  {
    id: 'LC280-01',
    styleCode: 'TC-GL280',
    colourName: 'Antique Gold',
    hex: '#C5A059',
    name: 'Antique Gold Scalloped Cord & Pleated Zari Lace Border',
    description: 'Opulent antique gold zari lace border featuring a contoured scalloped cord wave edge and raised pleated geometric chevron track on fine mesh. Available at ₹30/meter or ₹280 for a full 9-meter bundle.',
    tags: ['Lace', 'Zari', 'Gold', 'Antique Gold', 'Scallop', 'Cordwork', 'Per Meter', '9m Bundle', 'Festive'],
    unitType: 'bundle',
    bundleSizeMeters: 9,
    bundlePrice: 280,
    price: 30,
    sellingPricePerMeter: 30,
    mrp: 60,
    materialType: 'Antique Gold Zari, Metallic Cord & Mesh',
    stock: 90,
    photo: '/products/lace/LC280-01.jpg',
    photoGallery: ['/products/lace/LC280-01.jpg']
  }
];

async function main() {
  console.log(`🌸 Seeding ${NEW_LACES.length} lace items to Firestore (Target: ${prod ? 'PRODUCTION' : 'EMULATOR'} "${projectId}")...\n`);

  const batch = db.batch();
  for (const l of NEW_LACES) {
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
      sellingPricePerMeter: l.sellingPricePerMeter,
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
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`  + ${l.id.padEnd(10)} [${l.styleCode}] ${l.name} - ₹${l.price}/m, ₹${l.bundlePrice}/9m bundle`);
  }

  await batch.commit();
  console.log(`\n🎉 Successfully seeded ${NEW_LACES.length} laces to Firestore!`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
