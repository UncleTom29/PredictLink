// backend/src/evidence-handler.ts
import Arweave from 'arweave';
import { sha256 } from 'js-sha256';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  timeout: 20000,
});

export async function uploadEvidence(evidenceData: string, sources: string[]): Promise<string> {
  try {
    // Prepare bundle
    const transaction = await arweave.createTransaction(
      { data: Buffer.from(JSON.stringify({ evidenceData, sources, timestamp: Date.now() })) },
      await loadWallet()
    );

    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('App-Name', 'PredictLink-Oracle');
    transaction.addTag('Event-Type', 'Evidence-Bundle');

    await arweave.transactions.sign(transaction, await loadWallet());
    await arweave.transactions.post(transaction);

    return transaction.id;
  } catch (error) {
    console.error('Arweave upload error:', error);
    throw new Error('Evidence upload failed');
  }
}

async function loadWallet() {
  // Securely load from env or file
  const key = JSON.parse(process.env.ARWEAVE_PRIVATE_KEY || '{}');
  return key;
}

// Helper to verify hash
export function verifyEvidenceHash(txId: string, expectedHash: string): Promise<boolean> {
  // Fetch from Arweave and hash
  return arweave.transactions.getData(txId, { decode: true, string: true }).then(data => {
    const actualHash = sha256(data);
    return actualHash === expectedHash;
  });
}