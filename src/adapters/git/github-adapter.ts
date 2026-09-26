export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
}

export interface CreatePullRequestParams {
  repo: string;
  title: string;
  head: string;
  base: string;
  body: string;
}

export interface PullRequestResult {
  number: number;
  htmlUrl: string;
  title: string;
  state: 'open' | 'closed';
  createdAt: string;
}

export class GitHubAdapter {
  private mockMode = true;

  constructor(mockMode = true) {
    this.mockMode = mockMode;
  }

  public isMockMode(): boolean {
    return this.mockMode;
  }

  public async listRepositories(): Promise<GitHubRepo[]> {
    return [
      {
        id: 101,
        name: 'janki-desktop',
        fullName: 'local-user/janki-desktop',
        defaultBranch: 'main',
        isPrivate: true,
        htmlUrl: 'https://github.com/local-user/janki-desktop'
      },
      {
        id: 102,
        name: 'web-app-client',
        fullName: 'local-user/web-app-client',
        defaultBranch: 'main',
        isPrivate: true,
        htmlUrl: 'https://github.com/local-user/web-app-client'
      }
    ];
  }

  public async createPullRequest(params: CreatePullRequestParams): Promise<PullRequestResult> {
    const prNumber = Math.floor(Math.random() * 800) + 10;
    return {
      number: prNumber,
      title: params.title,
      htmlUrl: `https://github.com/${params.repo}/pull/${prNumber}`,
      state: 'open',
      createdAt: new Date().toISOString(),
    };
  }
}

export const githubAdapter = new GitHubAdapter(true);
