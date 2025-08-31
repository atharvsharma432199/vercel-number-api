import { loadDatabase } from '../lib/database.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret, db_id, batch_size } = req.body;

  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  try {
    let result;
    
    if (db_id) {
      const dbConfig = DATABASE_CONFIG.find(db => db.id === db_id);
      if (!dbConfig) return res.status(404).json({ error: 'Database not found' });
      
      result = await loadDatabase(dbConfig, batch_size || 1000);
    } else {
      const results = [];
      for (const dbConfig of DATABASE_CONFIG.filter(db => db.enabled)) {
        const dbResult = await loadDatabase(dbConfig, batch_size || 1000);
        results.push({ db: dbConfig.id, ...dbResult });
      }
      result = results;
    }

    res.status(200).json({ success: true, result });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
