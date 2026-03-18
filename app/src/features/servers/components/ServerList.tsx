import { useState } from 'react';
import { useServers } from '../api/useServers';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/shared/ui/Table';
import { MoreHorizontal, HardDrive, Cpu, TerminalSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ServerList = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useServers({ page, page_size: 10 });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Node</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>OS</TableHead>
                <TableHead>Hardware</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                      <div className="h-3 w-48 bg-zinc-100 dark:bg-zinc-800/50 rounded animate-pulse" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                      <div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800/50 rounded animate-pulse" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                      <div className="h-4 w-12 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto animate-pulse" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-lg flex flex-col items-center text-center">
        <p className="font-semibold mb-2">Failed to load servers</p>
        <p className="text-sm opacity-80 mb-4">{(error as Error).message}</p>
        <Button variant="outline" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  const servers = data?.data || [];
  const total = data?.total || 0;

  if (servers.length === 0) {
    return (
      <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-lg bg-white dark:bg-[#121212]">
        <TerminalSquare className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-1">No Servers Found</h3>
        <p className="text-sm max-w-sm mx-auto">Start by provisioning a new compute node or adding an existing server to your cluster.</p>
        <Link to="/servers/add">
          <Button variant="primary" className="mt-6">Add New Server</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Node</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>Hardware</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {servers.map(s => (
              <TableRow key={s.id} className="group">
                <TableCell>
                  <div className="flex flex-col">
                    <Link to={`/servers/${s.id}`} className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors cursor-pointer">
                      {s.name}
                    </Link>
                    {s.description && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 truncate mt-0.5">
                        {s.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={s.status === 'online' ? 'success' : s.status === 'offline' ? 'error' : 'warning'}
                  >
                    {s.status === 'online' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
                    {s.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                  {s.ip_address}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="capitalize text-sm">{s.os}</span>
                    {s.os_version && <span className="text-zinc-400 text-xs bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{s.os_version}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    <div className="flex items-center gap-1" title={`${s.cpu_cores} vCPU`}><Cpu size={14} className="text-zinc-400" /> {s.cpu_cores} </div>
                    <div className="flex items-center gap-1" title={`${s.memory_gb}GB RAM`}><HardDrive size={14} className="text-zinc-400" /> {s.memory_gb}GB</div>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination Header - Minimal style */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[13px] bg-white dark:bg-[#121212]">
          <div className="text-zinc-500 dark:text-zinc-400 font-medium">
            Showing <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{(page - 1) * 10 + 1}</span> to <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{Math.min(page * 10, total)}</span> of <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{total}</span>
          </div>
          <div className="flex gap-1.5">
            <Button 
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="h-8 px-3 text-[13px]"
            >
              Previous
            </Button>
            <Button 
              variant="outline"
              size="sm"
              disabled={page * 10 >= total}
              onClick={() => setPage(p => p + 1)}
              className="h-8 px-3 text-[13px]"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
