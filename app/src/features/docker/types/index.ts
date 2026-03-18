export interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  State: string;
  Status: string;
  Ports: { IP: string; PrivatePort: number; PublicPort?: number; Type: string }[];
  Labels: Record<string, string>;
}

export interface DockerImage {
  Id: string;
  ParentId: string;
  RepoTags: string[];
  RepoDigests: string[];
  Created: number;
  Size: number;
  VirtualSize: number;
  SharedSize: number;
  Labels: Record<string, string>;
  Containers: number;
}

export interface DockerNetwork {
  Id: string;
  Name: string;
  Scope: string;
  Driver: string;
  EnableIPv6: boolean;
  Internal: boolean;
  Created: string;
}

export interface DockerVolume {
  Name: string;
  Driver: string;
  Mountpoint: string;
  CreatedAt: string;
  Labels: Record<string, string>;
}

export interface DockerStack {
  Name: string;
  Services: number;
  Status: string;
  CreatedAt: string;
}