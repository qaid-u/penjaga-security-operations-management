export const Table = ({ children, className = '' }) => (
  <div className={`w-full overflow-x-auto ${className}`}>
    <table className="w-full text-left text-sm whitespace-nowrap">
      {children}
    </table>
  </div>
);

export const Thead = ({ children }) => (
  <thead className="app-elevated text-tertiary-token">
    {children}
  </thead>
);

export const Th = ({ children, className = '' }) => (
  <th className={`app-divider px-6 py-3 font-medium border-b ${className}`}>
    {children}
  </th>
);

export const Tbody = ({ children }) => (
  <tbody className="divide-y divide-[var(--color-border-subtle)]">
    {children}
  </tbody>
);

export const Tr = ({ children, className = '' }) => (
  <tr className={`transition-colors hover:bg-[var(--color-bg-hover)] ${className}`}>
    {children}
  </tr>
);

export const Td = ({ children, className = '' }) => (
  <td className={`px-6 py-4 text-secondary-token ${className}`}>
    {children}
  </td>
);
