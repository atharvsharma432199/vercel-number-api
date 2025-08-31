import { Redis } from '@vercel/kv';
import { parse } from 'csv-parse/sync';
import { getEnabledDatabases } from './config.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const NUMBER_PARTITIONS = parseInt(process.env.NUMBER_PARTITIONS) || 1000;
let masterNumberMap = new Map();

const getPartitionKey = (number) => {
  const hash = number.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `part:${hash % NUMBER_PARTITIONS}`;
};

const isValidNumber = (number) => {
  return /^[6-9]\d{9}$/.test(number?.trim());
};

export async function loadDatabase(dbConfig, batchSize = 1000) {
  try {
    console.log(`🔄 Loading ${dbConfig.name}...`);
    
    const response = await fetch(dbConfig.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const csvData = await response.text();
    const lines = csvData.split('\n').slice(1);
    let processed = 0;
    let batch = [];

    for (const line of lines) {
      const columns = line.split(',');
      if (columns.length >= 13) {
        const [name, fathersName, phoneNumber, otherNumber, passportNumber, 
               aadharNumber, age, gender, address, district, pincode, state, town] = columns;
        
        const recordData = {
          name: name?.trim(),
          fathersName: fathersName?.trim(),
          phoneNumber: phoneNumber?.trim(),
          otherNumber: otherNumber?.trim(),
          passportNumber: passportNumber?.trim(),
          aadharNumber: aadharNumber?.trim(),
          age: age?.trim(),
          gender: gender?.trim(),
          address: address?.trim(),
          district: district?.trim(),
          pincode: pincode?.trim(),
          state: state?.trim(),
          town: town?.trim()
        };

        if (phoneNumber && isValidNumber(phoneNumber)) {
          batch.push([phoneNumber.trim(), { ...recordData, source: dbConfig.id }]);
        }
        if (otherNumber && isValidNumber(otherNumber)) {
          batch.push([otherNumber.trim(), { ...recordData, source: dbConfig.id }]);
        }

        if (batch.length >= batchSize) {
          await processBatch(batch);
          processed += batch.length;
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      await processBatch(batch);
      processed += batch.length;
    }

    console.log(`✅ ${dbConfig.name}: ${processed} records`);
    return { success: true, processed };

  } catch (error) {
    console.error(`❌ ${dbConfig.name} failed:`, error.message);
    return { success: false, error: error.message };
  }
}

async function processBatch(batch) {
  const pipeline = redis.pipeline();
  
  for (const [number, data] of batch) {
    const partitionKey = getPartitionKey(number);
    pipeline.hset(partitionKey, { [number]: JSON.stringify(data) });
    masterNumberMap.set(number, data);
  }
  
  await pipeline.exec();
}

export async function getNumberInfo(number) {
  try {
    const cacheKey = `num:${number}`;
    
    const cached = await redis.get(cacheKey);
    if (cached) return { ...JSON.parse(cached), cached: true };

    const partitionKey = getPartitionKey(number);
    const storedData = await redis.hget(partitionKey, number);
    
    if (storedData) {
      const data = JSON.parse(storedData);
      await redis.setex(cacheKey, 3600, JSON.stringify(data));
      return { ...data, cached: false };
    }

    return null;

  } catch (error) {
    console.error('Lookup error:', error);
    return null;
  }
}

export async function getDatabaseStats() {
  try {
    const enabledDbs = getEnabledDatabases();
    const totalKeys = await redis.dbsize();
    
    return {
      total_databases: 14,
      enabled_databases: enabledDbs.length,
      estimated_records: totalKeys * 300,
      databases: enabledDbs.map(db => ({
        id: db.id,
        name: db.name,
        enabled: db.enabled,
        status: 'loaded'
      }))
    };
  } catch (error) {
    return { error: error.message };
  }
}
