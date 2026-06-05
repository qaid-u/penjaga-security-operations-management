import React from 'react';

export const Table = ({ children, className = '' }) => (
  <div className={`w-full overflow-x-auto ${className}`}>
    <table className="w-full text-left text-sm whitespace-nowrap">
      {children}
    </table>
  </div>
);

export const Thead = ({ children }) => (
  <thead className="bg-gray-50/50 dark:bg-slate-800/50 text-gray-500 dark:text-gray-400">
    {children}
  </thead>
);

export const Th = ({ children, className = '' }) => (
  <th className={`px-6 py-3 font-medium border-b border-gray-200 dark:border-slate-700 ${className}`}>
    {children}
  </th>
);

export const Tbody = ({ children }) => (
  <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
    {children}
  </tbody>
);

export const Tr = ({ children, className = '' }) => (
  <tr className={`hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors ${className}`}>
    {children}
  </tr>
);

export const Td = ({ children, className = '' }) => (
  <td className={`px-6 py-4 text-gray-700 dark:text-gray-300 ${className}`}>
    {children}
  </td>
);
