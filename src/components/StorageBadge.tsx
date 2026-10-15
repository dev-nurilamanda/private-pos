import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { requestPersistentStorage, type StorageStatus } from '../db/db';
import { formatBytes } from '../utils/formatters';

export const StorageBadge: React.FC = () => {
  const [status, setStatus] = useState<StorageStatus>({ isPersisted: false });
  const [showTooltip, setShowTooltip] = useState(false);

  const checkStorage = async () => {
    try {
      const res = await requestPersistentStorage();
      setStatus(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkStorage();
  }, []);

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={checkStorage}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 transition cursor-pointer"
        title="Status Penyimpanan Browser"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            status.isPersisted ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
          }`}
        />
        {status.isPersisted ? (
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
        )}
      </button>

      {/* Floating tooltip */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-56 p-2.5 bg-slate-900 border border-slate-700 rounded-xl shadow-xl text-[11px] text-slate-300 pointer-events-none">
          <p className="font-semibold text-white">
            {status.isPersisted ? 'Penyimpanan Terkunci (Aman)' : 'Penyimpanan Standar'}
          </p>
          <p className="text-slate-400 mt-0.5">
            {status.isPersisted
              ? 'IndexedDB tidak akan dihapus otomatis oleh browser.'
              : 'Klik untuk mengunci IndexedDB agar permanen.'}
          </p>
          {status.usedBytes !== undefined && (
            <p className="text-emerald-400 font-mono mt-1 pt-1 border-t border-slate-800">
              Data: {formatBytes(status.usedBytes)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
