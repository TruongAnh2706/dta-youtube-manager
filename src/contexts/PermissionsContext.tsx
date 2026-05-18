import React, { createContext, useContext } from 'react';
import { RolePermissions } from '../types';
import { DEFAULT_PERMISSIONS } from '../constants/permissions';

interface PermissionsContextType {
    rolePermissions: RolePermissions;
}

const PermissionsContext = createContext<PermissionsContextType>({ rolePermissions: DEFAULT_PERMISSIONS });

export function PermissionsProvider({ children, rolePermissions }: { children: React.ReactNode, rolePermissions: RolePermissions }) {
    return (
        <PermissionsContext.Provider value={{ rolePermissions }}>
            {children}
        </PermissionsContext.Provider>
    );
}

export function usePermissionsContext() {
    return useContext(PermissionsContext);
}
