import { initAdmin } from './lib/admin';
import { FieldValue } from 'firebase-admin/firestore';

const { db, prod, projectId } = initAdmin();

async function main() {
  console.log(`▸ Updating product TC00063 (Doc ID: v0A6LTOTzbr6EW6e66qt) in ${prod ? 'PRODUCTION' : 'EMULATOR'} "${projectId}"...`);

  const docRef = db.collection('products').doc('v0A6LTOTzbr6EW6e66qt');
  const snap = await docRef.get();

  if (!snap.exists) {
    console.error('✗ Document v0A6LTOTzbr6EW6e66qt not found');
    process.exit(1);
  }

  const updatedName = 'Dusty Rose Embroidered Designer Wear';
  const updatedDesc = 'A sophisticated dusty rose designer ensemble featuring intricate tone-on-tone embroidery and subtle metallic highlights across a structured silhouette. Cut to drape gracefully from the shoulders down to an elegant floor-length flare, making it an ideal statement piece for evening receptions, cocktail parties, and festive celebrations.';

  await docRef.update({
    name: updatedName,
    description: updatedDesc,
    materialType: 'Embroidered Silk Blend',
    colors: [{ name: 'Dusty Rose', hex: '#d6b4a9' }],
    colourName: 'Dusty Rose',
    tags: ['Designer Wear', 'Dusty Rose', 'Embroidered', 'Evening Wear', 'Festive'],
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`✓ Updated product TC00063:`);
  console.log(`   Name: "${updatedName}"`);
  console.log(`   Description: "${updatedDesc}"`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
