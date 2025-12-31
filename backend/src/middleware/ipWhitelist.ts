import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { getClientIp } from '../utils/ipHelper';

export interface IpWhitelistRequest extends Request {
  skipIpCheck?: boolean;
}

export async function checkIpWhitelist(req: IpWhitelistRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const ipAddress = getClientIp(req);

    const settings = await query('SELECT * FROM system_settings WHERE key = ?', ['ip_whitelist_enabled']);
    
    if (settings.length === 0 || settings[0].value !== 'true') {
      next();
      return;
    }

    const whitelist = await query(
      'SELECT * FROM ip_whitelist WHERE enabled = 1'
    );

    if (whitelist.length === 0) {
      logger.warn(`IP whitelist is enabled but empty, blocking access for IP ${ipAddress}`);
      res.status(403).json({ error: 'Access denied: IP whitelist is enabled but no IPs are configured' });
      return;
    }

    const isAllowed = whitelist.some((item: any) => {
      const whitelistIp = item.ip_address.trim();
      const requestIp = ipAddress.trim();

      if (whitelistIp === requestIp) {
        return true;
      }

      if (whitelistIp.includes('/')) {
        const [network, prefixLength] = whitelistIp.split('/');
        const mask = parseInt(prefixLength, 10);
        const networkParts = network.split('.').map(Number);
        const ipParts = requestIp.split('.').map(Number);

        if (networkParts.length !== 4 || ipParts.length !== 4) {
          return false;
        }

        const networkNum = (networkParts[0] << 24) + (networkParts[1] << 16) + (networkParts[2] << 8) + networkParts[3];
        const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
        const maskNum = ~((1 << (32 - mask)) - 1);

        return (networkNum & maskNum) === (ipNum & maskNum);
      }

      return false;
    });

    if (!isAllowed) {
      logger.warn(`IP ${ipAddress} not in whitelist`);
      res.status(403).json({ error: 'Access denied: IP not in whitelist' });
      return;
    }

    next();
  } catch (error) {
    logger.error('IP whitelist check error:', error);
    res.status(500).json({ error: 'Failed to check IP whitelist' });
  }
}
