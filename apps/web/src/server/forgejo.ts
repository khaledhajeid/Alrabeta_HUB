// Calls the Forgejo API as the alrabeta-bot service account, not on behalf
// of any individual member — see FORGEJO_API_TOKEN in the README.

type ForgejoCommit = {
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string | null;
  authorUsername: string | null;
  authoredAt: Date;
  url: string;
};

type RawForgejoCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; email: string; date: string } };
  author: { login: string } | null;
};

export async function fetchRecentCommits(
  owner: string,
  repo: string,
  ref: string,
  limit = 100,
): Promise<ForgejoCommit[]> {
  const url = `${process.env.FORGEJO_URL}/api/v1/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(ref)}&limit=${limit}&stat=false&verification=false`;

  const res = await fetch(url, {
    headers: { Authorization: `token ${process.env.FORGEJO_API_TOKEN}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Forgejo API ${res.status} fetching commits for ${owner}/${repo}@${ref}`);
  }

  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];

  return (data as RawForgejoCommit[]).map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    authorName: c.commit.author.name,
    authorEmail: c.commit.author.email ?? null,
    authorUsername: c.author?.login ?? null,
    authoredAt: new Date(c.commit.author.date),
    url: c.html_url,
  }));
}
