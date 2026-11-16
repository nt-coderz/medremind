import { db } from './db.js';

console.log('[Backup] Initiating MedRemind database snapshot...');
const result = db.createBackup();
console.log(`[Backup] Success! Created ${result.backupFile}`);
console.log('[Backup] Summary:', JSON.stringify(result.counts, null, 2));
