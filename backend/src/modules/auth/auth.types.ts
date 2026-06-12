export interface AuthUser {
  id: string;
  githubId: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
}
