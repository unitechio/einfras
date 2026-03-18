import { Plus, Search, Filter, RefreshCw, Server as ServerIcon } from "lucide-react";
import { ServerList } from "../components/ServerList";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Link } from "react-router-dom";

export const ServersPage = () => (
  <div className="space-y-6 animate-in fade-in duration-500 pb-20">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
          <ServerIcon className="h-6 w-6 text-blue-500" />
          Servers
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Manage and monitor your infrastructure nodes.
        </p>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
        <Button variant="outline" size="md">
          <RefreshCw className="mr-2 h-4 w-4 text-zinc-400" />
          Refresh
        </Button>
        <Link to="/servers/add">
          <Button variant="primary" size="md">
            <Plus className="mr-2 h-4 w-4" />
            Add Server
          </Button>
        </Link>
      </div>
    </div>

    {/* Toolbar */}
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="w-full sm:max-w-xs">
        <Input placeholder="Search servers..." icon={<Search className="h-4 w-4" />} />
      </div>
      <Button variant="outline" size="md" className="sm:ml-auto">
        <Filter className="mr-2 h-4 w-4 text-zinc-400" />
        Filter By Status
      </Button>
    </div>

    {/* Server Data Table */}
    <ServerList />
  </div>
);
