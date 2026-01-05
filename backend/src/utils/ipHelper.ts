import { Request } from 'express';
import { logger } from './logger';

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip'];
  const trueClientIp = req.headers['true-client-ip'];
  const xClusterClientIp = req.headers['x-cluster-client-ip'];

  logger.debug(`IP Debug - X-Forwarded-For: ${forwarded}, X-Real-IP: ${realIp}, req.ip: ${req.ip}, req.connection.remoteAddress: ${req.connection?.remoteAddress}`);

  const DOCKER_GATEWAY_IPS = ['192.168.107.1', '172.17.0.1', '172.18.0.1', '192.168.117.1'];
  const DOCKER_CONTAINER_IPS = ['192.168.107.2', '192.168.107.3', '172.17.0.2', '172.18.0.2', '192.168.117.3'];
  const FRONTEND_PROXY_IPS = ['192.168.117.1', '192.168.116.1', '10.0.0.1', '172.19.0.1', '172.20.0.1'];
  const LOCAL_IPS = ['127.0.0.1', '::1', '0.0.0.0', '::'];

  const isInternalIp = (ip: string): boolean => {
    if (!ip) return true;
    if (LOCAL_IPS.includes(ip)) return true;
    if (DOCKER_GATEWAY_IPS.includes(ip)) return true;
    if (DOCKER_CONTAINER_IPS.includes(ip)) return true;
    if (FRONTEND_PROXY_IPS.includes(ip)) return true;
    if (ip.startsWith('172.17.') || ip.startsWith('172.18.') || ip.startsWith('172.19.') || ip.startsWith('172.20.')) return true;
    if (ip.startsWith('192.168.107.') || ip.startsWith('192.168.116.') || ip.startsWith('192.168.117.')) return true;
    return false;
  };

  logger.debug(`IP Debug - Check forwarded: ${typeof forwarded}, value: ${forwarded}`);

  if (typeof forwarded === 'string') {
    const ips = forwarded.split(',').map(ip => ip.trim());
    for (const ip of ips) {
      if (ip && !isInternalIp(ip)) {
        return ip;
      }
    }
  }

  if (Array.isArray(forwarded)) {
    const ips = forwarded[0].split(',').map(ip => ip.trim());
    for (const ip of ips) {
      if (ip && !isInternalIp(ip)) {
        return ip;
      }
    }
  }

  if (typeof realIp === 'string') {
    const trimmedRealIp = realIp.trim();
    if (trimmedRealIp && !isInternalIp(trimmedRealIp)) {
      return trimmedRealIp;
    }
  }

  if (typeof cfConnectingIp === 'string') {
    const trimmedCfIp = cfConnectingIp.trim();
    if (trimmedCfIp && !isInternalIp(trimmedCfIp)) {
      return trimmedCfIp;
    }
  }

  if (typeof trueClientIp === 'string') {
    const trimmedTrueClientIp = trueClientIp.trim();
    if (trimmedTrueClientIp && !isInternalIp(trimmedTrueClientIp)) {
      return trimmedTrueClientIp;
    }
  }

  if (typeof xClusterClientIp === 'string') {
    const trimmedXClusterIp = xClusterClientIp.trim();
    if (trimmedXClusterIp && !isInternalIp(trimmedXClusterIp)) {
      return trimmedXClusterIp;
    }
  }

  if (req.ip && !isInternalIp(req.ip)) {
    if (req.ip.startsWith('::ffff:')) {
      const ipv4 = req.ip.substring(7);
      if (!isInternalIp(ipv4)) {
        return ipv4;
      }
    } else {
      return req.ip;
    }
  }

  const connectionIp = req.connection?.remoteAddress || '';
  if (connectionIp) {
    let ip = connectionIp;
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }
    if (ip && !isInternalIp(ip)) {
      return ip;
    }
  }

  return req.ip || 'unknown';
}

export function getBeijingTime(): string {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  return beijingTime.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}
