export interface Repository {
  id: string;
  url: string;
  branch: string;
}

export interface Registry {
  id: string;
  name: string;
  provider: string;
  url: string;
  username?: string;
  password?: string;
  token?: string;
  registry?: string;
  region?: string;
  is_anonymous?: boolean;
  is_default?: boolean;
  pull_presets?: string[];
  created_at?: string;
  updated_at?: string;
}
