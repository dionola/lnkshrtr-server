import crypto from 'crypto';

export const generateShortCode = (length: number = 6): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const generateUniqueShortCode = async (): Promise<string> => {
  const { prisma } = await import('./prisma');
  let shortCode: string;
  let isUnique = false;
  
  do {
    shortCode = generateShortCode();
    const existing = await prisma.link.findUnique({
      where: { shortCode }
    });
    isUnique = !existing;
  } while (!isUnique);
  
  return shortCode;
};

export const formatUrl = (url: string): string => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const generateRandomString = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};
