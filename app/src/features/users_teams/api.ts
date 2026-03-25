import { api } from "@/shared/api/client";

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  teams: string[];
  created_at: string;
}

export interface RoleRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  permissions: string[];
  is_system: boolean;
}

export interface TeamRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  member_ids: string[];
  member_count: number;
}

export interface ListMeta {
  page: number;
  page_size: number;
  total: number;
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }
    query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export const usersTeamsApi = {
  listUsers: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
    sort_by?: string;
    sort_dir?: "asc" | "desc";
  }) => {
    const result = await api.get<{ items: UserRecord[]; meta?: ListMeta }>(
      `/iam/users${buildQuery(params)}`,
    );
    return { items: result.items ?? [], meta: result.meta };
  },
  createUser: (body: {
    username: string;
    email: string;
    full_name: string;
    password: string;
    roles: string[];
    team_ids: string[];
    is_active?: boolean;
  }) => api.post<UserRecord>("/iam/users", body),
  updateUser: (
    id: string,
    body: {
      username: string;
      email: string;
      full_name: string;
      password?: string;
      roles: string[];
      team_ids: string[];
      is_active?: boolean;
    },
  ) => api.put<UserRecord>(`/iam/users/${id}`, body),
  deleteUser: (id: string) => api.delete<{ message: string }>(`/iam/users/${id}`),

  listRoles: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    system?: boolean;
    sort_by?: string;
    sort_dir?: "asc" | "desc";
  }) => {
    const result = await api.get<{ items: RoleRecord[]; meta?: ListMeta }>(
      `/iam/roles${buildQuery(params)}`,
    );
    return { items: result.items ?? [], meta: result.meta };
  },
  createRole: (body: {
    name: string;
    slug: string;
    description: string;
    permissions: string[];
  }) => api.post<RoleRecord>("/iam/roles", body),
  updateRole: (
    id: string,
    body: {
      name: string;
      slug: string;
      description: string;
      permissions: string[];
    },
  ) => api.put<RoleRecord>(`/iam/roles/${id}`, body),
  deleteRole: (id: string) => api.delete<{ message: string }>(`/iam/roles/${id}`),

  listTeams: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    sort_by?: string;
    sort_dir?: "asc" | "desc";
  }) => {
    const result = await api.get<{ items: TeamRecord[]; meta?: ListMeta }>(
      `/iam/teams${buildQuery(params)}`,
    );
    return { items: result.items ?? [], meta: result.meta };
  },
  createTeam: (body: {
    name: string;
    slug: string;
    description: string;
    member_ids: string[];
  }) => api.post<TeamRecord>("/iam/teams", body),
  updateTeam: (
    id: string,
    body: {
      name: string;
      slug: string;
      description: string;
      member_ids: string[];
    },
  ) => api.put<TeamRecord>(`/iam/teams/${id}`, body),
  deleteTeam: (id: string) => api.delete<{ message: string }>(`/iam/teams/${id}`),
};
