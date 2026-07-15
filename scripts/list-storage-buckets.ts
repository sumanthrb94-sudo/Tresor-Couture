import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

initializeApp({ credential: applicationDefault(), projectId: 'tresor-couture' });

async function main() {
  const storage = getStorage();
  const bucketNames = [
    'tresor-couture.appspot.com',
    'tresor-couture.firebasestorage.app',
  ];
  for (const name of bucketNames) {
    try {
      const [metadata] = await storage.bucket(name).getMetadata();
      console.log('✓ Bucket exists:', metadata.name);
    } catch (err: any) {
      console.log('✗ Bucket not found:', name, '-', err.message);
    }
  }
  // Also try default bucket
  try {
    const [metadata] = await storage.bucket().getMetadata();
    console.log('✓ Default bucket:', metadata.name);
  } catch (err: any) {
    console.log('✗ Default bucket not found:', err.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
