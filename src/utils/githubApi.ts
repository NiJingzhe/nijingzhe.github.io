import type { GitHubCardData } from '../components/GitHubCard';

interface GitHubApiResponse {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  html_url: string;
}

/**
 * 从 GitHub API 获取仓库信息
 * @param repoPath 仓库路径，格式：owner/repo 或完整的 GitHub URL
 * @returns Promise<GitHubCardData>
 */
export const fetchGitHubRepoInfo = async (repoPath: string): Promise<GitHubCardData> => {
  // 解析仓库路径
  let owner: string;
  let repo: string;

  // 如果是完整的 URL，提取 owner/repo
  if (repoPath.startsWith('http')) {
    const url = new URL(repoPath);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      owner = pathParts[0];
      repo = pathParts[1];
    } else {
      throw new Error('Invalid GitHub URL format');
    }
  } else {
    // 假设格式是 owner/repo
    const parts = repoPath.split('/').filter(Boolean);
    if (parts.length >= 2) {
      owner = parts[0];
      repo = parts[1];
    } else {
      throw new Error('Invalid repository path format. Expected: owner/repo');
    }
  }

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Repository not found');
      }
      if (response.status === 403) {
        throw new Error('API rate limit exceeded. Please try again later.');
      }
      throw new Error(`Failed to fetch repository: ${response.statusText}`);
    }

    const data: GitHubApiResponse = await response.json();

    return {
      repo: data.full_name,
      url: data.html_url,
      language: data.language || 'Unknown',
      stars: data.stargazers_count,
      forks: data.forks_count,
      description: data.description || 'No description provided.',
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred while fetching repository info');
  }
};

