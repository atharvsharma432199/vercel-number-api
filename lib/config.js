export const DATABASE_CONFIG = [
  { id: 'db1', name: 'Database 1', url: process.env.DB1_URL, enabled: true, weight: 1 },
  { id: 'db2', name: 'Database 2', url: process.env.DB2_URL, enabled: true, weight: 1 },
  { id: 'db3', name: 'Database 3', url: process.env.DB3_URL, enabled: true, weight: 1 },
  { id: 'db4', name: 'Database 4', url: process.env.DB4_URL, enabled: true, weight: 1 },
  { id: 'db5', name: 'Database 5', url: process.env.DB5_URL, enabled: true, weight: 1 },
  { id: 'db6', name: 'Database 6', url: process.env.DB6_URL, enabled: true, weight: 1 },
  { id: 'db7', name: 'Database 7', url: process.env.DB7_URL, enabled: true, weight: 1 },
  { id: 'db8', name: 'Database 8', url: process.env.DB8_URL, enabled: true, weight: 1 },
  { id: 'db9', name: 'Database 9', url: process.env.DB9_URL, enabled: true, weight: 1 },
  { id: 'db10', name: 'Database 10', url: process.env.DB10_URL, enabled: true, weight: 1 },
  { id: 'db11', name: 'Database 11', url: process.env.DB11_URL, enabled: true, weight: 1 },
  { id: 'db12', name: 'Database 12', url: process.env.DB12_URL, enabled: true, weight: 1 },
  { id: 'db13', name: 'Database 13', url: process.env.DB13_URL, enabled: true, weight: 1 },
  { id: 'db14', name: 'Database 14', url: process.env.DB14_URL, enabled: true, weight: 1 }
];

export const getEnabledDatabases = () => {
  return DATABASE_CONFIG.filter(db => db.enabled);
};
