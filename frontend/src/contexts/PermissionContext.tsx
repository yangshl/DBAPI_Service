import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PermissionContextType {
  permissions: string[];
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (permissionCodes: string[]) => boolean;
  loading: boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

interface PermissionProviderProps {
  children: ReactNode;
  userRole: string;
}

export const PermissionProvider: React.FC<PermissionProviderProps> = ({ children, userRole }) => {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/permissions/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const permCodes = data.data.map((p: any) => p.code);
        setPermissions(permCodes);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [userRole]);

  const hasPermission = (permissionCode: string): boolean => {
    return permissions.includes(permissionCode);
  };

  const hasAnyPermission = (permissionCodes: string[]): boolean => {
    return permissionCodes.some(code => permissions.includes(code));
  };

  const refreshPermissions = async () => {
    await fetchPermissions();
  };

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        hasPermission,
        hasAnyPermission,
        loading,
        refreshPermissions
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};
