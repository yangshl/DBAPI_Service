import React from 'react';
import { usePermissions } from '../contexts/PermissionContext';

interface PermissionGuardProps {
  permissionCode: string;
  permissionCodes?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permissionCode,
  permissionCodes,
  requireAll = false,
  fallback = null,
  children
}) => {
  const { hasPermission, hasAnyPermission } = usePermissions();

  let hasAccess = false;

  if (permissionCode) {
    hasAccess = hasPermission(permissionCode);
  } else if (permissionCodes && permissionCodes.length > 0) {
    if (requireAll) {
      hasAccess = permissionCodes.every(code => hasPermission(code));
    } else {
      hasAccess = hasAnyPermission(permissionCodes);
    }
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

interface ButtonPermissionProps {
  permissionCode: string;
  children: React.ReactNode;
}

export const ButtonPermission: React.FC<ButtonPermissionProps> = ({ permissionCode, children }) => {
  const { hasPermission } = usePermissions();

  if (!hasPermission(permissionCode)) {
    return null;
  }

  return <>{children}</>;
};
