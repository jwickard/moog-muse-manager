import crypto from 'crypto';

export function calculateChecksum(data: string): string {
  return crypto.createHash('md5').update(data).digest('hex');
} 