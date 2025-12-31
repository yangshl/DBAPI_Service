import { Request } from 'express';
import { logger } from './logger';

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip'];

  logger.info('IP Debug - Headers:', {
    'x-forwarded-for': forwarded,
    'x-real-ip': realIp,
    'cf-connecting-ip': cfConnectingIp,
    'req.ip': req.ip,
    'req.connection.remoteAddress': req.connection?.remoteAddress
  });

  if (typeof forwarded === 'string') {
    const ips = forwarded.split(',').map(ip => ip.trim());
    logger.info('IP Debug - Using forwarded:', ips[0]);
    return ips[0];
  }

  if (Array.isArray(forwarded)) {
    const ips = forwarded[0].split(',').map(ip => ip.trim());
    logger.info('IP Debug - Using forwarded (array):', ips[0]);
    return ips[0];
  }

  if (typeof realIp === 'string') {
    logger.info('IP Debug - Using real-ip:', realIp.trim());
    return realIp.trim();
  }

  if (typeof cfConnectingIp === 'string') {
    logger.info('IP Debug - Using cf-connecting-ip:', cfConnectingIp.trim());
    return cfConnectingIp.trim();
  }

  const ip = req.ip || req.connection?.remoteAddress || '';
  
  if (ip.includes(':')) {
    const parts = ip.split(':');
    const result = parts[parts.length - 1];
    logger.info('IP Debug - Using req.ip (IPv6):', result);
    return result;
  }

  logger.info('IP Debug - Using req.ip:', ip);
  return ip;
}

export function getBeijingTime(): string {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return beijingTime.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}
